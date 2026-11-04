# frozen_string_literal: true
# encoding: UTF-8
#
# = gantt-common.rb — Golden 15.13
#
# Harness que roda o pipeline real do tj3 (parse → schedule →
# generateIntermediateFormat) sobre um .tjp e extrai a **geometria** do Gantt
# chart de cada coluna `chart`: período, largura/altura, cabeçalho (escala,
# grid, linhas now/markdate), linhas do chart com o conteúdo de cada uma
# (barras, marcos, containers, load stacks) e as setas de dependência.
#
# Complementa `reports-common.rb`: lá a coluna `chart` é comparada apenas
# estruturalmente (`<gantt>`), porque as Fases 14 ainda não tinham o Gantt.
# Aqui os dois motores geram o chart e o snapshot é comparado campo a campo
# (posições em pixels com tolerância de 1px do lado TypeScript).
#
# Os objetos de conteúdo do Gantt não expõem readers no Ruby (só ivars), então
# a extração usa `instance_variable_get` — exatamente o que o walker TS faz com
# os campos `private` equivalentes.
#
# `GanttChart#to_html` é chamado de propósito: é ele que dispara
# `completeChart` (router, `@depArrows` e `@arrowHeads`). Sem isso as setas não
# existem no momento da extração.

require 'json'

$:.unshift File.expand_path('../../taskjuggler/lib', __dir__)
require 'taskjuggler/Tj3Config'
require 'taskjuggler/AppConfig'
require 'taskjuggler/TaskJuggler'
require 'taskjuggler/RichText'
require 'taskjuggler/reports/ReportTable'
require 'taskjuggler/reports/ReportTableCell'
require 'taskjuggler/reports/GanttChart'
require 'taskjuggler/reports/GanttTaskBar'
require 'taskjuggler/reports/GanttMilestone'
require 'taskjuggler/reports/GanttContainer'
require 'taskjuggler/reports/GanttLoadStack'

module GanttGolden
  # Raiz do repositório (scripts/golden/../..).
  def self.root
    @root ||= File.expand_path('../..', __dir__)
  end

  # Roda o pipeline completo e extrai o snapshot de cada coluna `chart`.
  #
  # O fuso é fixado em UTC — mas não por escolha estética: `TaskJuggler#initialize`
  # chama `TjTime.setTimeZone('UTC')` (TaskJuggler.rb:40) logo no começo, então
  # qualquer fuso setado antes do `new` é descartado. Mesmo se não fosse, UTC é o
  # que o `tj3` de linha de comando usa. O `tz` do caso é o valor **efetivo**
  # (lido de `TjTime.timeZone`), e o teste TS espelha exatamente esse valor.
  #
  # Retorna { 'charts' => [...], 'chartErrors' => [...], 'error' => nil, 'tz' }
  def self.run(tjp_path, tz: 'UTC')
    AppConfig.appName = 'taskjuggler3'
    ENV['TASKJUGGLER_DATA_PATH'] =
      File.expand_path('../../taskjuggler', __dir__) + ':'
    TaskJuggler::TjTime.setTimeZone(tz)

    # Silencia o MessageHandler para que avisos de parse não poluam o stdout
    # (JSON) e não abortem o processo — igual a reports-common.rb.
    mh = TaskJuggler::MessageHandlerInstance.instance
    mh.reset
    mh.outputLevel = :none
    mh.trapSetup = true

    out = { 'charts' => [], 'chartErrors' => [], 'error' => nil, 'tz' => tz }
    begin
      tj = TaskJuggler.new
      # O construtor reseta o fuso para UTC; registra o valor efetivo.
      out['tz'] = TaskJuggler::TjTime.timeZone
      return err(out, "parse failed for #{tjp_path}") unless tj.parse([tjp_path])
      return err(out, 'schedule failed') unless tj.schedule

      project = tj.project
      project.reports.each do |report|
        formats = report.get('formats')
        next unless formats && !formats.empty?

        project.reportContexts << TaskJuggler::ReportContext.new(project, report)
        begin
          report.generateIntermediateFormat
          charts_of(report).each { |chart| out['charts'] << chart }
        rescue StandardError => e
          # Falha do próprio Ruby ao montar o relatório (não do walker): não há
          # geometria para comparar. Fica registrado no caso para o teste TS
          # pular com o motivo à vista — não pode desaparecer em silêncio.
          out['chartErrors'] << {
            'report' => report.fullId,
            'error' => "#{e.class}: #{e.message.lines.first.to_s.strip}"
          }
        ensure
          project.reportContexts.pop
        end
      end
    rescue StandardError => e
      err(out, "#{e.class}: #{e.message.lines.first.to_s.strip}")
    end
    out
  end

  # Snapshots das colunas `chart` do relatório já gerado.
  def self.charts_of(report)
    content = report.content
    return [] unless content && content.instance_variable_defined?(:@table)

    table = content.instance_variable_get(:@table)
    return [] unless table

    table.instance_variable_get(:@columns).each_with_index.filter_map do |col, idx|
      chart = col.cell1.special
      next unless chart && chart.class.name.to_s.end_with?('GanttChart')

      chart_snapshot(report, idx, chart)
    end
  end

  # Snapshot completo de um GanttChart (geometria + linhas + setas).
  def self.chart_snapshot(report, column_idx, chart)
    # Dispara `completeChart`: router, `@depArrows` e `@arrowHeads`.
    chart.to_html
    header = chart.header

    {
      'report' => report.fullId,
      'column' => column_idx,
      'scale' => chart.scale['name'].to_s,
      'startDate' => chart.start.to_i,
      'endDate' => chart.end.to_i,
      'width' => chart.width.to_i,
      'height' => chart.instance_variable_get(:@height).to_i,
      'viewWidth' => chart.instance_variable_get(:@viewWidth),
      'scrollbar' => chart.hasScrollbar?,
      'header' => {
        'height' => header.height,
        'nowLineX' => header.nowLineX,
        'markdateLineX' => header.markdateLineX,
        'gridLines' => header.gridLines,
        'cellStartDates' => header.cellStartDates.map(&:to_i)
      },
      'lines' => chart.instance_variable_get(:@lines).map { |l| line_snapshot(l) },
      'depArrows' => chart.instance_variable_get(:@depArrows).map do |arrow|
        arrow.map { |pt| pt.map(&:to_i) }
      end,
      'arrowHeads' => chart.instance_variable_get(:@arrowHeads).map do |pt|
        pt.map(&:to_i)
      end
    }
  end

  # Snapshot de uma GanttLine: y/altura/categoria e o conteúdo ordenado.
  def self.line_snapshot(line)
    {
      'y' => line.y,
      'height' => line.height,
      'category' => line.instance_variable_get(:@category),
      'content' => line.instance_variable_get(:@content).map { |c| content_snapshot(c) }
    }
  end

  # Snapshot de um elemento de conteúdo. As chaves espelham os nomes dos campos
  # do port TS (`x`/`xEnd`/`y`/`w`/`yLevels`/`drawFrame`).
  def self.content_snapshot(content)
    case content
    when TaskJuggler::GanttTaskBar
      {
        'kind' => 'taskbar',
        'x' => content.instance_variable_get(:@start),
        'xEnd' => content.instance_variable_get(:@end),
        'y' => content.instance_variable_get(:@y)
      }
    when TaskJuggler::GanttMilestone
      {
        'kind' => 'milestone',
        'x' => content.instance_variable_get(:@x),
        'y' => content.instance_variable_get(:@y)
      }
    when TaskJuggler::GanttContainer
      {
        'kind' => 'container',
        'x' => content.instance_variable_get(:@start),
        'xEnd' => content.instance_variable_get(:@end),
        'y' => content.instance_variable_get(:@y)
      }
    when TaskJuggler::GanttLoadStack
      {
        'kind' => 'loadstack',
        'x' => content.instance_variable_get(:@x),
        'y' => content.instance_variable_get(:@y),
        'w' => content.instance_variable_get(:@w),
        'yLevels' => content.instance_variable_get(:@yLevels),
        'drawFrame' => content.instance_variable_get(:@drawFrame)
      }
    else
      { 'kind' => content.class.name.to_s.split('::').last }
    end
  end

  def self.err(out, msg)
    out['error'] = msg
    out
  end

  # Caso no formato de `gantt.golden.json`.
  def self.case_for(rel_file, tz: 'UTC')
    result = run(File.join(root, rel_file), tz: tz)
    {
      'file' => rel_file,
      'tz' => result['tz'],
      'error' => result['error'],
      'chartErrors' => result['chartErrors'],
      'charts' => result['charts']
    }
  end

  # Envelope `{ 'cases' => [...] }` a partir de uma lista de rel_files.
  def self.cases_for_list(rel_files)
    { 'cases' => rel_files.map { |f| case_for(f) } }
  end

  # Lista de caminhos relativos (a partir da raiz) dos .tjp de um diretório do
  # TestSuite, ordenada para golden determinístico.
  def self.tjp_dir(rel_dir)
    Dir[File.join(root, rel_dir, '*.tjp')].sort.map do |abs|
      abs.sub("#{root}/", '')
    end
  end
end
