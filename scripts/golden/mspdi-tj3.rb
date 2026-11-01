# frozen_string_literal: true
# encoding: UTF-8
#
# = mspdi-tj3.rb — Golden 14C.4.1 (oracle MSPDI)
#
# Roda o exportador MSP do tj3 real sobre um `.tjp` e serializa o documento
# `<Project>` normalizado em JSON. O lado TypeScript
# (`packages/core/tests/reports/mspdi_oracle_14c_test.ts`) reproduz o mesmo
# walker (`packages/core/tests/golden/mspdi-normalize.ts`) sobre o XML gerado
# pelo `MspXmlRE` portado e compara com este golden.
#
# ## Normalização (determinismo)
#
# O cabeçalho do MSPDI carrega valores voláteis: o comentário de geração
# (software/versão/timestamp) e os elementos `CreationDate`/`CurrentDate`/
# `StatusDate` derivados de `TjTime.now`/`project.now`. Eles são removidos do
# walker — a comparação cobre estrutura, atributos, datas **agendadas** e
# `TimephasedData`, que são determinísticas para o fixture.
#
# Elementos vazios (`<Tasks/>`) viram `{ "tag": ..., "text": null,
# "children": [] }`; texto é colapsado em whitespace (mesma regra do TS).

require 'json'
require 'rexml/document'

$:.unshift File.expand_path('../../taskjuggler/lib', __dir__)
require 'taskjuggler/Tj3Config'
require 'taskjuggler/AppConfig'
require 'taskjuggler/TaskJuggler'
require 'taskjuggler/reports/Report'
require 'taskjuggler/reports/ReportContext'
require 'taskjuggler/reports/MspXmlRE'

module MspdiGolden
  # Elementos cujo valor depende do relógio de geração, não do agendamento.
  VOLATILE = %w[CreationDate CurrentDate StatusDate].freeze

  # Texto normalizado (whitespace colapsado); nil quando vazio.
  def self.norm_text(value)
    return nil if value.nil?

    s = value.to_s.gsub(/[ \t\r\n]+/, ' ').strip
    s.empty? ? nil : s
  end

  # Walker recursivo REXML → Hash determinístico.
  def self.node(el)
    children = []
    el.each_element do |child|
      next if VOLATILE.include?(child.name)

      children << node(child)
    end
    {
      'tag' => el.name,
      'text' => el.has_elements? ? nil : norm_text(el.text),
      'children' => children
    }
  end

  # Documento completo a partir da string XML.
  def self.document(xml)
    root = REXML::Document.new(xml).root
    node(root)
  end

  # Roda parse → schedule → MspXmlRE sobre `rel_path` (relativo à raiz do
  # repo) e devolve o envelope `{ file:, report:, tz:, error:, project: {} }`.
  # O caminho vai relativo no golden para a geração ser portátil.
  def self.run(rel_path, report_id, tz: 'UTC')
    tjp_path = File.join(root, rel_path)
    AppConfig.appName = 'taskjuggler3'
    ENV['TASKJUGGLER_DATA_PATH'] =
      File.expand_path('../../taskjuggler', __dir__) + ':'
    TaskJuggler::TjTime.setTimeZone(tz)

    mh = TaskJuggler::MessageHandlerInstance.instance
    mh.reset
    mh.outputLevel = :none
    mh.trapSetup = true

    out = { 'file' => rel_path, 'report' => report_id, 'tz' => tz,
            'error' => nil, 'project' => nil }
    begin
      tj = TaskJuggler.new
      return err(out, "parse failed for #{rel_path}") unless tj.parse([tjp_path])
      return err(out, 'schedule failed') unless tj.schedule

      project = tj.project
      report = find_report(project, report_id)
      return err(out, "report #{report_id} not found") unless report

      project.reportContexts << TaskJuggler::ReportContext.new(project, report)
      begin
        xml = TaskJuggler::MspXmlRE.new(report).to_mspxml
        out['project'] = document(xml)
      ensure
        project.reportContexts.pop
      end
    rescue StandardError => e
      err(out, "#{e.class}: #{e.message.lines.first.to_s.strip}")
    end
    out
  end

  # Relatórios são indexados por `reportN` no PropertySet; o nome declarado
  # (`export "MS Project"`) fica em `report.name`.
  def self.find_report(project, name)
    found = nil
    project.reports.each do |report|
      found ||= report if report.name == name
    end
    found
  end

  def self.err(out, msg)
    out['error'] = msg
    out
  end

  def self.root
    @root ||= File.expand_path('../..', __dir__)
  end
end

FIXTURE = 'packages/core/tests/fixtures/ext/14c-mspdi.tjp'
REPORT_ID = 'MS Project'

case_result = MspdiGolden.run(FIXTURE, REPORT_ID)
puts JSON.pretty_generate({ 'cases' => [case_result] })
