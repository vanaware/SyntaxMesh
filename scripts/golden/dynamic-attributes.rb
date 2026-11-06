#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# dynamic-attributes.rb — golden de `Project#generateReport` com
# `dynamicAttributes` (Fase 18.19).
#
# Oracle: parseia um projeto real, agenda e chama
# `Project#generateReport(id, false, nil, snippet)` — exatamente o caminho do
# `-A`/`--attr` do `tj3`. Para cada caso serializa o estado **observável**
# depois da geração:
#
#   columns  — ids das colunas (o backup do Ruby é raso, então os valores das
#              listas NÃO voltam; as colunas do snippet permanecem);
#   headers  — rótulos do cabeçalho da tabela HTML gerada;
#   tasks    — nomes das tarefas que apareceram na tabela;
#   errors   — nº de erros do MessageHandler e os ids registrados.
#
# O HTML é capturado redirecionando `$stdout` durante a geração: com
# `interactive` o Ruby escreve o relatório em `"."`.
#
# Divergências conhecidas (não cobertas pelo golden):
#   - o `<title>` do HTML do port sai `undefined - <arquivo>` (o nome do
#     projeto não é resolvido ali) — lacuna pré-existente da Fase 14/17,
#     alheia ao `dynamicAttributes`;
#   - num erro de sintaxe o Ruby para no primeiro (`no_reduce`) e **sai**
#     (SystemExit); o port acumula a cascata do FSM e devolve as mensagens
#     (18.19.6). Por isso o caso de erro compara só o estado do relatório.
#
# Serializa `{ cases: [ { description, dynamic, columns, headers, tasks,
# errors, errorIds } ] }`.
#
# @see docs/taskjuggler/lib/taskjuggler/Project.rb:generateReport
# @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.19)
$LOAD_PATH.unshift(File.expand_path('../../docs/taskjuggler/lib', __dir__))
require 'json'
require 'stringio'
require 'tmpdir'
require 'taskjuggler/AppConfig'
require 'taskjuggler/TaskJuggler'

TJ = TaskJuggler
TJ::TjTime.setTimeZone('UTC')
ENV['TASKJUGGLER_DATA_PATH'] =
  File.expand_path('../../docs/taskjuggler', __dir__) + ':'
AppConfig.appName = 'tj3'

FIXTURE = <<~TJP
  project prj "Dynamic Attributes" "1.0" 2026-01-01 - 2026-12-31 {
    timezone "UTC"
    now 2026-02-01
    workinghours mon - fri 9:00 - 17:00
    scenario plan "Plan" {
    }
    trackingscenario plan
  }
  resource dev "Developer" {
  }
  task a "Alpha" {
    effort 5d
    allocate dev
  }
  task b "Beta" {
    effort 3d
    allocate dev
  }
  taskreport dyn "dyn.tjp" {
    formats html
    columns id
    period 2026-01-01 - 2026-12-31
  }
TJP

def project_in(dir)
  file = File.join(dir, 'dyn.tjp')
  File.write(file, FIXTURE)
  Dir.chdir(dir) do
    tj = TaskJuggler.new
    abort('parse failed') unless tj.parse([file])
    prj = tj.project
    prj.schedule
    return prj
  end
end

# Rótulos do cabeçalho (células em negrito) e nomes de tarefas da tabela.
def headers_of(html)
  html.scan(/font-weight:bold; ">([^<]*)<\/td>/).flatten.map(&:strip)
end

def tasks_of(html)
  # Células de conteúdo (a coluna `id` do fixture); os cabeçalhos usam
  # `font-weight:bold` e não caem aqui.
  cells = html.scan(/white-space:nowrap; ?">([^<]+)<\/td>/).flatten
  cells & %w[a b]
end

def generate(prj, snippet)
  dir = Dir.mktmpdir('dynattr')
  begin
    Dir.chdir(dir) do
      captured = StringIO.new
      stdout = $stdout
      $stdout = captured
      begin
        prj.generateReport('dyn', false, nil, snippet)
      ensure
        $stdout = stdout
      end
      # Sem `dynamicAttributes` o relatório não é interativo e vai para o
      # arquivo (`Report#outputFileName`); com o snippet vai para o stdout.
      html = captured.string
      html += File.read('dyn.tjp.html') if File.exist?('dyn.tjp.html')
      return html
    end
  ensure
    FileUtils.remove_entry(dir) if File.directory?(dir)
  end
end

$cases = []

def tc(description, dynamic)
  mh = TaskJuggler::MessageHandlerInstance.instance
  mh.reset
  prj = project_in(Dir.mktmpdir('dynattr-prj'))
  report = prj.reports['dyn']

  error = nil
  begin
    html = generate(prj, dynamic)
  rescue SystemExit
    # O Ruby aborta o processo no primeiro erro de sintaxe (ver cabeçalho).
    html = ''
  rescue StandardError => e
    error = "#{e.class}: #{e.message}"
    html = ''
  end

  $cases << {
    'description' => description,
    'dynamic' => dynamic,
    'columns' => (report.get('columns') || []).map { |c| c && c.id },
    'headers' => headers_of(html),
    'tasks' => tasks_of(html),
    'errors' => mh.errors,
    'errorIds' => mh.messages.select { |m| m.type == :error }.map { |m| m.id.to_s },
    'error' => error
  }
end

require 'fileutils'

tc('sem dynamicAttributes usa as colunas do arquivo', nil)
tc('columns acrescenta a coluna name',
   'columns id, name')
tc('columns respeita a ordem pedida',
   'columns name, id')
tc('hidetask remove uma tarefa da tabela',
   'hidetask plan.id = "b"')
tc('hidetask pode inverter a seleção',
   'hidetask plan.id = "a"')
tc('coluna desconhecida vira erro e não corrompe a lista',
   'columns id, naoExiste')

puts({ 'cases' => $cases }.to_json)
