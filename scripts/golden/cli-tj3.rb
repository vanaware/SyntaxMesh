#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# cli-tj3.rb — golden de fidelidade da CLI contra o `tj3` real (Fase 24.7).
#
# Roda o TaskJuggler Ruby do `docs/taskjuggler` sobre o **subset** de fixtures
# que a CLI também consegue processar e grava o que é observável de fora:
# código de saída, inventário de artefatos (caminhos relativos), mensagens do
# `MessageHandler` e, para os fixtures de paridade, o conteúdo dos arquivos
# gerados. O teste `packages/cli/tests/golden_cli_test.ts` roda a CLI no mesmo
# subset e compara com o mesmo critério.
#
# Por que não comparar tudo:
#
# - **Avisos**: o port ainda emite `priority_inversion` e os `*_check` que o
#   Ruby só avalia com o motor de queries, e o Ruby emite `no_reports`
#   (projeto sem relatório) que o port não emite. Só a **primeira** mensagem é
#   comparada, e só nos fixtures de erro (24.7.8).
# - **stdout**: o `tj3` imprime banner GPL + barra de progresso; a CLI imprime
#   o resumo do projeto (24.4.5). Os dois são descartados e sobra o
#   "resíduo" — linha de mensagem que vazou para o stdout, que deve ser vazio.
# - **HTML**: comparado por DOM canônico (24.7.7), não byte a byte: ids de
#   tooltip (`ID29120` × `ID1`), carimbo de criação e assinatura do produto
#   mudam por construção.
#
# Normalizações (24.7.2):
#
# - caminho do fixture → `<PATH>` (24.7.8 depende da localização literal).
# - versão do TaskJuggler → `<VER>`.
# - carimbo de criação do HTML → `<TS>`.
# - ids de tooltip `ID<dígitos>` → `ID<n>`.
# - números com 6+ casas decimais → `<NUM>` (ruído de ponto flutuante; a
#   precisão 1e-6 é a mesma dos goldens de financeiro).
#
# Uso: `ruby scripts/golden/cli-tj3.rb` (imprime o JSON no stdout).
#
# @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7)
# @see scripts/golden/README.md

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "tmpdir"
require "fileutils"
require "open3"

ROOT = File.expand_path("../..", __dir__)

# Projetos reais: as MWEs do tutorial + o corpus Syntax/Correct.
#
# Fora do subset (divergências do **core**, registradas em
# `packages/cli/tests/golden/known_divergences.md`):
#
# - `Learning/mwe004` — `task_start_in_parent` espúrio em `deliveries.start`
#   (mesma data impressa dos dois lados); já estava ignorado em
#   `cli.integration_test.ts` (D7).
# - `Syntax/Correct/AccountReport` — uma tarefa com 20 meses de esforço e duas
#   alocações de grupo estoura o intervalo do projeto no port e não no `tj3`
#   (D8).
# - `Syntax/Correct/Leave` — `resourcereport "."` faz o `tj3` escrever o HTML
#   no **stdout**; o port com `--output-dir` sempre grava em disco (D9).
#   A cobertura de `leaves` já existe em `scripts/golden/leaves.rb`.
PROJECT_FIXTURES =
  (1..9).reject { |i| i == 4 }.map do |i|
    format("docs/Learning/mwe%03d/tutorial.tjp", i)
  end +
  %w[Account Booking Celltext Complete Durations Flags Gap Include Limits-1
     LoadUnits Macro-1 Milestone Period Query textreport].map do |n|
    "docs/taskjuggler/test/TestSuite/Syntax/Correct/#{n}.tjp"
  end

# Fixtures de erro: todo `MessageHandler#error` derruba o processo (`exit 1`)
# e a primeira mensagem é comparada linha a linha com a do port.
ERROR_FIXTURES =
  %w[bad_time_zone no_token_match1 include_recursion adopt_self bad_include
     chargeset no_reduce].map do |n|
    "docs/taskjuggler/test/TestSuite/Syntax/Errors/#{n}.tjp"
  end

# Fixtures de paridade (extensão `.smx`; o `tj3` exige `.tjp`, então o script
# copia para um temporário). `compare` diz ao teste o que exigir:
#   exact     — conteúdo do artefato byte a byte (24.7.6)
#   dom       — conteúdo do HTML por DOM canônico (24.7.7)
#   artifacts — só código de saída + inventário (divergência registrada)
PARITY_FIXTURES = [
  ["parity-csv-tasks", "exact"],
  ["parity-csv-accounts", "exact"],
  ["parity-csv-balance", "artifacts"],
  ["parity-html", "dom"]
].freeze

FIXTURE_DIR = "packages/cli/tests/fixtures/golden"

# A versão vem do binário que roda como oráculo (o `AppConfig` da lib é
# `0.0.0` até o `bin/tj3` carimbar a versão real).
TJ_VERSION = `tj3 --version 2>/dev/null`.split.last

# Números com 6 ou mais casas decimais são ruído de ponto flutuante.
FLOAT_NOISE = /-?\d+\.\d{6,}/

# Mensagens do Ruby: `arquivo:linha: Tipo: texto` ou `Tipo: texto`.
MESSAGE_LINE = /^(?:.*?:\d+: )?(?:Fatal|Error|Warning|Info|Debug): /

# Linhas de progresso do `tj3` (elas terminam com a barra `[  Done  ]`).
TJ_NOISE = [
  /\AReading file /,
  /\A(?:Preparing|Scheduling|Checking|Reporting|Parsing|Generating) /,
  /\[\s*(?:Done|Failed|Skipped)\s*\]\s*\z/
].freeze

# Linhas do resumo do projeto que a CLI imprime (24.4.5). Fica do lado do
# teste (`golden_cli_test.ts`) filtrar; o `tj3` nunca as emite.
CLI_NOISE = [
  /\AProject .* v.*\z/,
  /\A  (?:timezone|period|tasks|cost): /
].freeze

# Caminhos de **origem** citados em mensagens: o `.tji` de um `include`, o
# diretório do fixture, o nome `.smx` copiado para `.tjp` — nenhum deles é
# comparável entre as duas implementações.
#
# Só `docs/` e `packages/` entram na classe: `css/`, `icons/` e `scripts/`
# aparecem como **conteúdo de relatório** (`src="icons/task.png"`) e ali são
# carga útil. O `:` fica de fora para não engolir o `:linha:` da mensagem.
REPO_PATH = %r{(?:docs|packages)/[\w./-]+}

# Normaliza caminhos, versão e ruído numérico.
def normalize(text, *paths)
  out = text.to_s.dup
  paths.compact.each { |p| out = out.gsub(p, "<PATH>") }
  out = out.gsub(REPO_PATH, "<PATH>")
  out = out.gsub(Regexp.new(Regexp.escape(TJ_VERSION)), "<VER>")
  out.gsub(FLOAT_NOISE, "<NUM>")
end

# Descarta o banner GPL: ele precede qualquer saída útil e quebra em várias
# linhas que não têm relação com o projeto.
def strip_banner(lines)
  last = lines.rindex { |l| l.start_with?("Free Software Foundation.") }
  last ? lines[(last + 1)..] : lines
end

# Remove o que é saída de UI e devolve as linhas restantes.
def residue(text, noise)
  lines = text.to_s.split("\n").map { |l| l.gsub(/\r/, "") }
  strip_banner(lines).reject do |line|
    line.strip.empty? || noise.any? { |re| re.match?(line) }
  end.map(&:rstrip)
end

# Linhas de mensagem do `MessageHandler` no stderr.
def messages(text)
  text.to_s.split("\n").map(&:rstrip).select { |l| MESSAGE_LINE.match?(l) }
end

# Caminhos relativos, ordenados, de todos os arquivos sob `dir`.
def artifacts(dir)
  Dir.glob(File.join(dir, "**", "*")).select { |f| File.file?(f) }.map do |f|
    f.dup.force_encoding("UTF-8").delete_prefix(dir + File::SEPARATOR)
  end.sort
end

# Conteúdo textual dos artefatos gerados, por caminho relativo.
def outputs(dir, compare)
  wanted = compare == "exact" ? %w[.csv .txt .tsv] : %w[.html]
  artifacts(dir).select { |name| wanted.include?(File.extname(name)) }
                .to_h do |name|
    [name, File.read(File.join(dir, name), encoding: "UTF-8")]
  end
end

# Carimba o HTML com marcadores estáveis (o teste canonicaliza o resto).
def stabilize_html(text)
  out = text.gsub(/ID\d+/, "ID<n>")
  out.gsub(/(<div class="copyright">.*? - )Created on.*?(<\/div>)/m,
           "\\1<TS>\\2")
end

$cases = []

PROJECT_FIXTURES.each do |path|
  id = if File.basename(File.dirname(path)) == "Correct"
         File.basename(path, ".tjp")
       else
         File.basename(File.dirname(path))
       end
  $cases << { "id" => id, "path" => path, "kind" => "project",
              "compare" => "artifacts" }
end

ERROR_FIXTURES.each do |path|
  $cases << { "id" => File.basename(path, ".tjp"), "path" => path,
              "kind" => "errors", "compare" => "artifacts" }
end

PARITY_FIXTURES.each do |id, compare|
  $cases << { "id" => id, "path" => "#{FIXTURE_DIR}/#{id}.smx",
              "kind" => "parity", "compare" => compare }
end

$cases.each do |kase|
  path = kase["path"]
  Dir.mktmpdir("golden-cli-") do |tmp|
    out_dir = File.join(tmp, "out")
    FileUtils.mkdir_p(out_dir)

    # O `tj3` recusa qualquer arquivo que não termine em `.tjp`.
    project =
      if kase["kind"] == "parity"
        copy = File.join(tmp, "#{kase["id"]}.tjp")
        FileUtils.cp(File.join(ROOT, path), copy)
        copy
      else
        path
      end

    stdout, stderr, status = Open3.capture3(
      "tj3", "-o", out_dir, project, chdir: ROOT
    )

    msgs = messages(stderr).map { |m| normalize(m, path, project) }
    kase["exit"] = status.exitstatus
    kase["artifacts"] = artifacts(out_dir)
    kase["messages"] = msgs
    kase["firstMessage"] = msgs.first
    kase["stdout"] = residue(normalize(stdout, path, project), TJ_NOISE)
    kase["stderr"] = residue(normalize(stderr, path, project), [MESSAGE_LINE])
    unless kase["compare"] == "artifacts"
      kase["outputs"] = outputs(out_dir, kase["compare"]).transform_values do |text|
        stabilized = stabilize_html(normalize(text, path, project))
        kase["compare"] == "dom" ? stabilized : text
      end
    end
  end
end

puts JSON.generate({ "cases" => $cases })
