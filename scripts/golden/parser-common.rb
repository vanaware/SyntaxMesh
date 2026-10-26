# frozen_string_literal: true
# encoding: UTF-8
#
# = parser-common.rb — Golden 10.19 (parser)
#
# Executa o parse de um arquivo .tjp exatamente como
# docs/taskjuggler/test/test_Syntax.rb (MessageChecker) e captura
# { file, ok, messages: [{ type, id, lineNo }] }.
#
# O Ruby é a fonte de verdade: `ok` segue TaskJuggler#parse
# (parse returned false OR MessageHandler errors > 0 => false).

require 'json'
require 'taskjuggler/TaskJuggler'

module ParserGolden
  # Parseia um arquivo e retorna o caso golden (sem o wrapper JSON).
  def self.run(file, rel = nil)
    ENV['TZ'] = 'Europe/Berlin' unless ENV['TZ']
    mh = TaskJuggler::MessageHandlerInstance.instance
    mh.reset
    mh.outputLevel = :none
    mh.trapSetup = true
    ok = false
    begin
      tj = TaskJuggler.new
      ok = !!tj.parse([file])
    rescue TaskJuggler::TjRuntimeError
      ok = false
    end
    msgs = mh.messages.map do |m|
      {
        'type' => m.type.to_s,
        'id' => m.id.to_s,
        'lineNo' => (m.sourceFileInfo ? m.sourceFileInfo.lineNo : nil)
      }
    end
    { 'file' => (rel || file), 'ok' => ok, 'messages' => msgs }
  end

  # Caminho relativo à raiz do repo (para os JSONs commitados).
  def self.rel_path(root, file)
    file.sub(%r{\A#{Regexp.escape(root)}/}, '')
  end
end
