# frozen_string_literal: true
# encoding: UTF-8
#
# = reports-common.rb — Golden 14.23
#
# Harness que roda o pipeline real do tj3 (parse → schedule →
# generateIntermediateFormat) sobre um .tjp e extrai o formato intermediário
# (`ReportTable`) de cada relatório de tabela: cabeçalhos e linhas com o texto
# normalizado das células. A extração espelha 1:1 o `extractTable` do lado
# TypeScript (`packages/core/tests/golden/extract-table.ts`) — os dois walkers
# é que são comparados, não o markup HTML (que difere por design).
#
# Células `special` (GanttChart, calendário ColumnTable, PlaceHolderCell) e
# células de gráfico (attributeId 'chart') são comparadas apenas
# estruturalmente (`<gantt>` / `<calendario>` / `<placeholder>`), pois a
# Fase 15/16 (Gantt) e a geometria de calendário não são portadas.

require 'json'

$:.unshift File.expand_path('../../taskjuggler/lib', __dir__)
require 'taskjuggler/Tj3Config'
require 'taskjuggler/AppConfig'
require 'taskjuggler/TaskJuggler'
require 'taskjuggler/RichText'
require 'taskjuggler/reports/ReportTable'
require 'taskjuggler/reports/ReportTableCell'
require 'taskjuggler/reports/ColumnTable'

module ReportsGolden
  # Normaliza texto de célula (String ou RichTextIntermediate): mesmo colapso
  # de whitespace dos dois lados da comparação.
  def self.norm_text(value)
    return nil if value.nil?

    s = value.to_s.gsub(/[ \t\r\n]+/, ' ').strip
    s.empty? ? nil : s
  end

  # Nome canônico de uma célula `special` para os dois motores.
  def self.special_kind(special)
    return nil unless special

    if special.is_a?(TaskJuggler::PlaceHolderCell)
      '<placeholder>'
    elsif special.class.name.to_s.end_with?('GanttChart')
      '<gantt>'
    elsif special.respond_to?(:to_html) && special.respond_to?(:to_csv)
      '<calendario>'
    else
      '<especial>'
    end
  end

  # attributeId da célula (via query), para detectar colunas chart/calendário.
  def self.cell_attribute_id(cell)
    q = cell.instance_variable_get(:@query)
    q && q.instance_variable_get(:@attributeId)
  rescue StandardError
    nil
  end

  # Text de uma célula, registrando a Query no RichText antes de `to_s` —
  # espelho do que `ReportTableCell#to_html` faz (`@text.setQuery(@query)`).
  # Sem isso, RichText com `[[query:…]]` (celltext, alert journal) levanta
  # "No Query has been registered for this RichText yet!".
  def self.cell_text_text(cell)
    txt = cell.text
    if txt.respond_to?(:setQuery) && !txt.frozen?
      q = cell.instance_variable_get(:@query)
      begin
        txt.setQuery(q) if q
      rescue StandardError
        nil
      end
    end
    norm_text(txt)
  rescue StandardError
    # RichText sem Query resolvível: texto não comparável, mas o KIND (~) é.
    nil
  end

  # Walk de uma ReportTableCell → array serializável; [] quando oculta.
  def self.cell_data(cell)
    return [] if cell.hidden

    attr_id = cell_attribute_id(cell)
    kind =
      if cell.special
        special_kind(cell.special)
      elsif attr_id == 'chart'
        '<gantt>'
      elsif %w[hourly daily weekly monthly quarterly yearly].include?(attr_id.to_s)
        '<calendario>'
      else
        '~'
      end

    if kind == '~'
      ['~', cell_text_text(cell), cell.indent,
       cell.rows == 1 ? nil : cell.rows,
       cell.columns == 1 ? nil : cell.columns]
    else
      [kind, cell.rows == 1 ? nil : cell.rows,
       cell.columns == 1 ? nil : cell.columns]
    end
  end

  # Verdadeiro se a linha é de cabeçalho (alguma célula headerCell).
  def self.header_line?(line)
    line.instance_variable_get(:@cells).any? do |c|
      c.instance_variable_get(:@headerCell)
    end
  end

  # Extrai { header:, rows: } de uma ReportTable (formato intermediário).
  def self.extract_table(table)
    header = []
    rows = []

    # Cabeçalho: vem das colunas (cell1 topo / cell2 base), não das @lines.
    table.instance_variable_get(:@columns).each do |col|
      c1 = col.cell1
      c2 = col.cell2
      entry = [cell_text_text(c1)]
      entry << cell_text_text(c2) if c1.rows == 2
      entry << special_kind(c1.special) if c1.special
      header << entry
    end

    table.instance_variable_get(:@lines).each do |line|
      line_cells = []
      line.instance_variable_get(:@cells).each do |cell|
        # PlaceHolderCell (linha de tabela embutida) não carrega texto próprio;
        # ignorada nos dois motores — o TS só percorre ReportTableCell.
        next if cell.is_a?(TaskJuggler::PlaceHolderCell)

        d = cell_data(cell)
        next if d.empty?

        if line_cells.empty?
          line_cells << [line.indentation, line.bold ? 1 : nil]
        end
        line_cells.concat(d)
      end
      next if line_cells.size <= 1

      rows << line_cells
    end
    { 'header' => header, 'rows' => rows }
  end

  # Conteúdo que construiu um ReportTable no formato intermediário.
  def self.table_content?(content)
    content && content.instance_variable_defined?(:@table) &&
      !content.instance_variable_get(:@table).nil?
  end

  # Roda o pipeline completo e extrai o formato intermediário de cada report.
  #
  # Retorna { 'reports' => [{ 'id', 'name', 'type', 'table' => {...} }, ...],
  #           'error' => String|nil }
  def self.run(tjp_path, tz: 'Europe/Berlin')
    AppConfig.appName = 'taskjuggler3'
    ENV['TASKJUGGLER_DATA_PATH'] =
      File.expand_path('../../taskjuggler', __dir__) + ':'
    TaskJuggler::TjTime.setTimeZone(tz)

    # Silencia o MessageHandler (como parser-common.rb / test_Syntax.rb) para
    # que erros de parse de arquivos do TestSuite não poluam o stdout (JSON) e
    # não abortem o processo. trapSetup = primeiro erro aborta aquele arquivo.
    mh = TaskJuggler::MessageHandlerInstance.instance
    mh.reset
    mh.outputLevel = :none
    mh.trapSetup = true

    out = { 'reports' => [], 'error' => nil }
    begin
      tj = TaskJuggler.new
      return err(out, "parse failed for #{tjp_path}") unless tj.parse([tjp_path])
      return err(out, 'schedule failed') unless tj.schedule

      project = tj.project

      project.reports.each do |report|
        formats = report.get('formats')
        next unless formats && !formats.empty?

        entry = { 'id' => report.fullId, 'name' => report.name,
                  'type' => report.typeSpec.to_s,
                  'formats' => formats.map(&:to_s).sort }
        begin
          project.reportContexts << TaskJuggler::ReportContext.new(project,
                                                                    report)
          begin
            report.generateIntermediateFormat
            content = report.content
            if table_content?(content)
              entry['table'] = extract_table(
                content.instance_variable_get(:@table),
              )
            end
          ensure
            project.reportContexts.pop
          end
        rescue StandardError => e
          entry['error'] = "#{e.class}: #{e.message.lines.first.to_s.strip}"
        end
        out['reports'] << entry
      end
    rescue StandardError => e
      err(out, "#{e.class}: #{e.message.lines.first.to_s.strip}")
    end
    out
  end

  def self.err(out, msg)
    out['error'] = msg
    out
  end

  # Caminho raiz do repositório (scripts/golden/../..).
  def self.root
    @root ||= File.expand_path('../..', __dir__)
  end

  # Casos de um .tjp no formato canônico de `reports.golden.json`.
  def self.case_for(rel_file, tz: 'Europe/Berlin')
    result = run(File.join(root, rel_file), tz: tz)
    {
      'file' => rel_file,
      'tz' => tz,
      'error' => result['error'],
      'reports' => result['reports'],
    }
  end

  # Lista de caminhos relativos (a partir da raiz) dos .tjp de um diretório do
  # TestSuite, ordenada para golden determinístico.
  def self.tjp_dir(rel_dir)
    Dir[File.join(root, rel_dir, '*.tjp')].sort.map do |abs|
      abs.sub("#{root}/", '')
    end
  end

  # envelope `{ 'cases' => [...] }` a partir de uma lista de rel_files.
  def self.cases_for_list(rel_files)
    { 'cases' => rel_files.map { |f| case_for(f) } }
  end
end
