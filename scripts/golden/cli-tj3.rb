#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# cli-tj3.rb — CLI fidelity golden against the real `tj3` (F24.7, scaled to
# the full corpus by F21 wave 1, 26.2).
#
# Runs the Ruby TaskJuggler from `docs/taskjuggler` over **every fixture of
# the corpus manifest** (`tests/fixtures/corpus.json`, ADR 042) and records
# what is observable from the outside: exit code, artifact inventory
# (relative paths), `MessageHandler` messages and — for the parity fixtures
# — the content of the generated files. The per-group tests in
# `packages/cli/tests/e2e_*_test.ts` run the CLI over the same fixtures and
# compare with the same criteria.
#
# Triage registry: `packages/cli/tests/golden/known-divergences.json`
# (26.6). Fixtures whose effective effect is `exclude` are recorded as
# `{ "excluded": "D<n>" }` **without running** — the runner asserts the
# registry anchor instead. Nothing is dropped silently.
#
# Why not everything is compared:
#
# - **Warnings**: the port still emits `priority_inversion` and the
#   `*_check` warnings that Ruby only evaluates with the query engine, and
#   Ruby emits `no_reports` (project without reports) that the port does
#   not. Only the **first** message is compared, and only on error
#   fixtures (24.7.8).
# - **stdout**: `tj3` prints the GPL banner + a progress bar; the CLI
#   prints the project summary (24.4.5). Both are discarded and what
#   remains is the "residue" — message lines that leaked to stdout, which
#   must be empty on both sides.
# - **HTML**: compared by canonical DOM (24.7.7), not byte for byte:
#   tooltip ids (`ID29120` × `ID1`), the creation stamp and the product
#   signature change by construction.
#
# Normalizations (24.7.2):
#
# - fixture path → `<PATH>` (24.7.8 depends on the literal location).
# - TaskJuggler version → `<VER>`.
# - HTML creation stamp → `<TS>`.
# - tooltip ids `ID<digits>` → `ID<n>`.
# - numbers with 6+ decimal places → `<NUM>` (floating point noise; the
#   1e-6 precision matches the finance goldens).
#
# Usage: `ruby scripts/golden/cli-tj3.rb` (prints the JSON on stdout;
# progress goes to stderr). Regenerate via `deno task golden:generate:ruby`.
#
# @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.2)
# @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
# @see scripts/golden/README.md

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "tmpdir"
require "fileutils"
require "open3"
require "time"

ROOT = File.expand_path("../..", __dir__)

# The corpus manifest is the single inventory (26.1): groups, ids and paths
# come from it — never from a hand-maintained list.
MANIFEST = JSON.parse(File.read(File.join(ROOT, "tests/fixtures/corpus.json")))

# Machine-readable triage registry (26.6): `exclude` entries skip the run.
REGISTRY = JSON.parse(
  File.read(File.join(ROOT, "packages/cli/tests/golden/known-divergences.json"))
)
EXCLUSIONS = REGISTRY["divergences"]
               .select { |d| d["effect"] == "exclude" && d["fixture"] != "*" }
               .map { |d| [d["fixture"], d["id"]] }

# Matches exact ids and group globs `<group>/*` (mirror of divergences.ts).
def exclusion_for(id)
  EXCLUSIONS.each do |pattern, div|
    return div if pattern == id
    return div if pattern.end_with?("/*") && id.start_with?(pattern[0..-2])
  end
  nil
end

# Parity fixtures (`.smx`; `tj3` demands `.tjp`, so the run copies to a
# temporary). `compare` tells the test what to require:
#   exact     — artifact content byte for byte (24.7.6)
#   dom       — HTML content by canonical DOM (24.7.7)
#   artifacts — exit code + inventory only (registered divergence)
PARITY_COMPARE = {
  "parity-csv-tasks" => "exact",
  "parity-csv-accounts" => "exact",
  "parity-csv-balance" => "artifacts",
  "parity-html" => "dom"
}.freeze

# Per-case wall clock limit: a hung `tj3` must not hang the regeneration.
# A killed case records exit 124 (the timeout convention).
CASE_TIMEOUT = 60

# The version comes from the binary that runs as the oracle (the lib's
# `AppConfig` is `0.0.0` until `bin/tj3` stamps the real version).
TJ_VERSION = `tj3 --version 2>/dev/null`.split.last

# Numbers with 6 or more decimal places are floating point noise.
FLOAT_NOISE = /-?\d+\.\d{6,}/

# Ruby messages: `file:line: Type: text` or `Type: text`.
MESSAGE_LINE = /^(?:.*?:\d+: )?(?:Fatal|Error|Warning|Info|Debug): /

# `tj3` progress lines (they end with the `[  Done  ]` bar).
TJ_NOISE = [
  /\AReading file /,
  /\A(?:Preparing|Scheduling|Checking|Reporting|Parsing|Generating) /,
  # Report-generation progress meter (`Report <name> …`), mirrored in CLI_NOISE.
  /\AReport /,
  /\[\s*(?:Done|Failed|Skipped)\s*\]\s*\z/
].freeze

# **Source** paths cited in messages: the `.tji` of an `include`, the
# fixture directory, the `.smx` name copied to `.tjp` — none of them is
# comparable between the two implementations.
#
# Only `docs/` and `packages/` enter the class: `css/`, `icons/` and
# `scripts/` appear as **report content** (`src="icons/task.png"`) and
# there they are payload. The `:` stays out so it does not swallow the
# message's `:line:`.
REPO_PATH = %r{(?:docs|packages)/[\w./-]+}

# Normalizes paths, version and numeric noise.
def normalize(text, *paths)
  out = text.to_s.dup
  paths.compact.each { |p| out = out.gsub(p, "<PATH>") }
  out = out.gsub(REPO_PATH, "<PATH>")
  out = out.gsub(Regexp.new(Regexp.escape(TJ_VERSION)), "<VER>")
  out.gsub(FLOAT_NOISE, "<NUM>")
end

# --- date / float canonicalization (messages only, F21 26.5) ---------------
#
# Mirror of `e2e-harness.ts#canonicalizeDates`: the port and `tj3` render the
# same instant differently (TjTime long form, plain ISO, JS ctime). All three
# canonicalize to UTC `YYYY-MM-DDTHH:MMZ` so the comparison checks the instant.

DATE_LONG = /\d{4}-\d{2}-\d{2}-\d{2}:\d{2}-[+-]\d{4}/
DATE_CTIME = /[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}(?: \([^)]*\))?/
DATE_PLAIN = /\d{4}-\d{2}-\d{2}(?![-T\d])/
FLOAT_INTEGRAL = /(\d+)\.0+(?![\d.])/
# Leading source location (`<PATH>:12: `): representation, not behavior.
# `tj3` omits it on runtime errors; stripped symmetrically (F21 26.5).
MESSAGE_LOCATION = /\A<PATH>:\d+: /

def canonical_instant(time)
  time.utc.strftime("%Y-%m-%dT%H:%MZ")
end

def canonicalize_dates(text)
  out = text.gsub(DATE_LONG) do |m|
    iso = "#{m[0, 10]}T#{m[11, 5]}:00#{m[17, 3]}:#{m[20, 2]}"
    begin
      canonical_instant(Time.parse(iso))
    rescue ArgumentError
      m
    end
  end
  out = out.gsub(DATE_CTIME) do |m|
    begin
      canonical_instant(Time.parse(m.sub(/ \([^)]*\)\z/, "")))
    rescue ArgumentError
      m
    end
  end
  out.gsub(DATE_PLAIN) { |m| "#{m}T00:00Z" }
end

def collapse_integral_floats(text)
  text.gsub(FLOAT_INTEGRAL) { Regexp.last_match(1) }
end

# Message-only normalization: paths/numbers + dates + integral floats + location.
def normalize_message(text, *paths)
  collapse_integral_floats(canonicalize_dates(normalize(text, *paths)))
    .sub(MESSAGE_LOCATION, "")
end

# Discards the GPL banner: it precedes any useful output and breaks into
# several lines unrelated to the project.
def strip_banner(lines)
  last = lines.rindex { |l| l.start_with?("Free Software Foundation.") }
  last ? lines[(last + 1)..] : lines
end

# Removes what is UI output and returns the remaining lines.
def residue(text, noise)
  lines = text.to_s.split("\n").map { |l| l.gsub(/\r/, "") }
  strip_banner(lines).reject do |line|
    line.strip.empty? || noise.any? { |re| re.match?(line) }
  end.map(&:rstrip)
end

# `MessageHandler` message lines on stderr.
def messages(text)
  text.to_s.split("\n").map(&:rstrip).select { |l| MESSAGE_LINE.match?(l) }
end

# Relative, sorted paths of every file under `dir`.
def artifacts(dir)
  Dir.glob(File.join(dir, "**", "*")).select { |f| File.file?(f) }.map do |f|
    f.dup.force_encoding("UTF-8").delete_prefix(dir + File::SEPARATOR)
  end.sort
end

# Textual content of the generated artifacts, by relative path.
def outputs(dir, compare)
  wanted = compare == "exact" ? %w[.csv .txt .tsv] : %w[.html]
  artifacts(dir).select { |name| wanted.include?(File.extname(name)) }
                .to_h do |name|
    [name, File.read(File.join(dir, name), encoding: "UTF-8")]
  end
end

# Stamps the HTML with stable markers (the test canonicalizes the rest).
def stabilize_html(text)
  out = text.gsub(/ID\d+/, "ID<n>")
  out.gsub(/(<div class="copyright">.*? - )Created on.*?(<\/div>)/m,
           "\\1<TS>\\2")
end

# Runs `tj3` with a wall clock watchdog. Both pipes are drained in
# threads (a full stderr pipe would deadlock a sequential read); the
# watchdog kills the process after CASE_TIMEOUT seconds.
def run_tj3(out_dir, project)
  Open3.popen3("tj3", "-o", out_dir, project, chdir: ROOT) do |stdin, stdout, stderr, wait_thr|
    stdin.close
    killed = false
    watchdog = Thread.new do
      unless wait_thr.join(CASE_TIMEOUT)
        killed = true
        begin
          Process.kill("KILL", wait_thr.pid)
        rescue Errno::ESRCH
          nil
        end
      end
    end
    out_reader = Thread.new { stdout.read }
    err_reader = Thread.new { stderr.read }
    out = out_reader.value
    err = err_reader.value
    watchdog.join
    status = wait_thr.value
    [out, err, killed ? 124 : status.exitstatus]
  end
end

# Runs one fixture and records the observable surface on the case.
def run_case(kase)
  path = kase["path"]
  Dir.mktmpdir("golden-cli-") do |tmp|
    out_dir = File.join(tmp, "out")
    FileUtils.mkdir_p(out_dir)

    # `tj3` refuses any file that does not end in `.tjp`.
    project =
      if kase["kind"] == "parity"
        copy = File.join(tmp, "#{File.basename(path, ".smx")}.tjp")
        FileUtils.cp(File.join(ROOT, path), copy)
        copy
      else
        path
      end

    stdout, stderr, code = run_tj3(out_dir, project)

    msgs = messages(stderr).map { |m| normalize_message(m, path, project) }
    kase["exit"] = code
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

cases = []
total = MANIFEST["total"]
MANIFEST["groups"].each do |group|
  gid = group["id"]
  group["fixtures"].each do |fixture|
    id = fixture["id"]
    kind =
      if gid.end_with?("-errors") then "errors"
      elsif gid == "parity" then "parity"
      else "project"
      end
    compare = kind == "parity" ? PARITY_COMPARE.fetch(id.split("/").last) : "artifacts"
    kase = { "id" => id, "path" => fixture["path"], "group" => gid,
             "kind" => kind, "compare" => compare }
    excluded = exclusion_for(id)
    if excluded
      kase["excluded"] = excluded
    else
      run_case(kase)
    end
    cases << kase
    warn format("[%3d/%3d] %s%s", cases.size, total, id,
                kase["excluded"] ? " (excluded #{kase["excluded"]})" : "")
  end
end

puts JSON.generate({ "cases" => cases })