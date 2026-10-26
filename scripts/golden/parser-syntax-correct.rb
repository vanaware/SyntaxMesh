# frozen_string_literal: true
# encoding: UTF-8
#
# = parser-syntax-correct.rb — Golden 10.19.4
#
# Itera docs/taskjuggler/test/TestSuite/Syntax/Correct/*.tjp (parse-only,
# como test_Syntax.rb#test_syntaxCorrect) e emite { "cases": [...] }.

require_relative 'parser-common'

ROOT = File.expand_path('../..', __dir__)
# Mesmas variáveis de ambiente que test_Syntax.rb injeta (arquivos usam $(TESTn)).
ENV['TEST1'] = 't_e_s_t_1'
ENV['TEST2'] = '"A test String"'
ENV['TEST3'] = '3'

cases = Dir.glob(File.join(ROOT, 'docs/taskjuggler/test/TestSuite/Syntax/Correct/*.tjp')).sort.map do |f|
  ParserGolden.run(f, ParserGolden.rel_path(ROOT, f))
end

puts JSON.generate({ 'cases' => cases })
