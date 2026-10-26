# frozen_string_literal: true
# encoding: UTF-8
#
# = parser-syntax-errors.rb — Golden 10.19.5
#
# Itera docs/taskjuggler/test/TestSuite/Syntax/Errors/*.tjp (como
# test_Syntax.rb#test_syntaxErrors). Cada caso captura a sequência real de
# mensagens Ruby { type, id, lineNo } — os `# MARK:` nos .tjp são o contrato
# que o MessageChecker valida; aqui gravamos o comportamento medido.

require_relative 'parser-common'

ROOT = File.expand_path('../..', __dir__)

cases = Dir.glob(File.join(ROOT, 'docs/taskjuggler/test/TestSuite/Syntax/Errors/*.tjp')).sort.map do |f|
  ParserGolden.run(f, ParserGolden.rel_path(ROOT, f))
end

puts JSON.generate({ 'cases' => cases })
