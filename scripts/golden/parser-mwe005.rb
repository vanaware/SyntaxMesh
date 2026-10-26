# frozen_string_literal: true
# encoding: UTF-8
#
# = parser-mwe005.rb — Golden 10.19.2/3
#
# Roda `tj3 --check-syntax` no tutorial mwe005 e captura { file, ok }.
# Os MWEs são syntaxe limpa: qualquer mensagem do tj3 vira ok=false.

require 'json'

ROOT = File.expand_path('../..', __dir__)
REL = 'docs/Learning/mwe005/tutorial.tjp'
file = File.join(ROOT, REL)

out = IO.popen(['tj3', '--check-syntax', '-o', '/tmp/tjgolden', file], err: [:child, :out], &:read)
ok = $?.exitstatus.zero? && !out.match?(/^Error:|WARNING/)

puts JSON.generate({ 'file' => REL, 'ok' => ok, 'messages' => [] })
