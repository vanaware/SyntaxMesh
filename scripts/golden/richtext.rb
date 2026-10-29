#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# scripts/golden/richtext.rb -- Golden do subsistema RichText (Fase 12.19).
#
# Usa o TaskJuggler Ruby real como oracle: para cada markup de exemplo,
# instancia `RichText.new(input)`, gera o RichTextIntermediate e serializa as
# três saídas (`to_s` / `to_tagged` / `to_html`). O resultado é escrito em
# `packages/core/tests/richtext/golden/richtext.golden.json` e consumido por
# `richtext_golden_test.ts`.
#
# Decisões de fidelidade:
#   * `MessageHandlerInstance.trapSetup = true` faz erros de parse virarem
#     exceção (não `exit`), como no harness de parser da Fase 10.
#   * O parser é um singleton (`RichText.class_variable_set(:@@parser, nil)`)
#     resetado a cada caso para que o estado de um markup não vaze para o próximo.
#   * Casos que o PRÓPRIO Ruby recusa (erros de sintaxe ambígua) são omitidos:
#     sem expectativa do oracle não há golden. Isso exclui `=====` (título de
#     nível 5, inexistente) e `'''...''...'''` (aninhamento ambíguo).
#   * A saída HTML crua do Ruby preserva a indentação do `XMLElement`; o teste
#     dourado normaliza whitespace *entre tags* (divergência de serialização
#     resolvida na Fase 17) — ver `richtext_golden_test.ts`.

$LOAD_PATH.unshift("/home/aarvati/github/syntaxmesh/docs/taskjuggler/lib")
require 'taskjuggler/RichText'
require 'taskjuggler/MessageHandler'
require 'json'

mh = TaskJuggler::MessageHandlerInstance.instance
mh.trapSetup = true

# { id, descrição (pt-BR), input, sectionNumbers? }
CASES = [
  ['para', 'Parágrafo simples de texto', "Texto simples aqui.\n\n"],
  ['two-paragraphs', 'Dois parágrafos separados por linha em branco',
   "Primeiro paragrafo.\n\nSegundo paragrafo.\n\n"],
  ['head-h1', 'Título de nível 1 com numeração de seção', "== Capitulo ==\n\n"],
  ['head-h1-text', 'Título de nível 1 seguido de parágrafo',
   "== Cap ==\n\nTexto normal aqui.\n\n"],
  ['head-h2', 'Título de nível 2', "=== Secao ===\n\n"],
  ['head-h3', 'Título de nível 3', "==== Subsecao ====\n\n"],
  ['head-nested', 'Títulos aninhados avançam os contadores de seção',
   "== A ==\n\n=== B ===\n\n== C ==\n\n"],
  ['bold', 'Negrito com três apóstrofos', "isto e '''negrito''' aqui\n\n"],
  ['italic', 'Itálico com dois apóstrofos', "isto e ''italico'' aqui\n\n"],
  ['underline', 'Sublinhado com underscores duplos',
   "isto e __sublinhado__ aqui\n\n"],
  ['bullet-list', 'Lista com marcadores', "* um\n* dois\n\n"],
  ['number-list', 'Lista numerada', "# um\n# dois\n\n"],
  ['nested-list', 'Item de lista aninhada', "** nivel2\n\n"],
  ['code-block', 'Bloco de código (negrito de múltiplas linhas)',
   "''' code block\nlinha2\n''' mais\n\n"],
  ['nowiki', 'Conteúdo nowiki preserva marcadores literalmente',
   "<nowiki>'''nao'''</nowiki>\n\n"],
  ['html-comment', 'Comentário HTML', "<!-- comentário -->\n\n"],
  ['href-simple', 'Link externo com rótulo', "[http://exemplo.com Exemplo]\n\n"],
  ['href-bare', 'Link externo sem rótulo (URL vira texto)',
   "[http://exemplo.com]\n\n"],
  ['ref-simple', 'Referência interna [[Section]]', "veja [[Section]] aqui\n\n"],
  ['ref-label', 'Referência interna com rótulo', "[[Section|Um rótulo]]\n\n"],
  ['ref-anchor', 'Referência interna com âncora', "[[Section#tag|Âncora]]\n\n"],
  ['table-basic', 'Tabela MediaWiki', "!| T\n!| c1 || c2\n|-\n| a || b\n|)\n\n"],
  ['quote', 'Citação', "\"\"\" citação\n\n"],
  ['deflist', 'Lista de definição', "; termo : definição\n\n"],
  ['hr', 'Linha horizontal', "----\n\n"],
  ['entity-amp', 'E comercial em texto', "A & B\n\n"],
  ['escape-brackets', 'Aspa escapa colchetes de referência',
   "\"[[não é ref]]\n\n"],
  ['no-trailing-blank', 'Texto sem linha em branco final',
   "sem linha em branco no fim"],
  ['multiline-para', 'Parágrafo de múltiplas linhas', "linha um\nlinha dois\n\n"],
  ['empty', 'Entrada vazia produz árvore raiz sem filhos', ""],
  ['image', 'Imagem via image:', "[[image:foto.png]]\n\n"],
  ['head-no-number', 'Título sem numeração de seção (sectionNumbers=false)',
   "== Capitulo ==\n\nTexto.\n\n", false],
]

out = { 'version' => 1, 'cases' => [] }
CASES.each do |id, desc, input, section_numbers|
  TaskJuggler::RichText.class_variable_set(:@@parser, nil)
  rt = TaskJuggler::RichText.new(input)
  rti = rt.generateIntermediateFormat
  raise "RichText retornou nil para #{id}" if rti.nil?
  rti.sectionNumbers = false if section_numbers == false
  html = rti.to_html
  out['cases'] << {
    'id' => id,
    'description' => desc,
    'input' => input,
    'sectionNumbers' => section_numbers != false,
    'expected' => {
      'plain' => rti.to_s,
      'tagged' => rti.to_tagged,
      'html' => html ? html.to_s : nil,
    },
  }
end

puts JSON.pretty_generate(out)
