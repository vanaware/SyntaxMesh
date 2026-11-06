# ADR 039 — Tipo `markdown` em `extend` (atributo dinâmico)

**Status:** Proposto (planejado; implementação nos Blocos C5 / 14C.19)
**Data:** 2026-11-06
**Fase:** 10 Complemento (parser/modelo) + 14 Complemento (consumo em relatórios)

## Contexto

`extend` no TaskJuggler (`TjpSyntaxRules.rb:1250-1360`) aceita `richtext`,
`text`, `date`, `number` e `reference` como tipos de atributo user-defined. O
RichText (MediaWiki) é o dialeto histórico dos `.tjp` (ADR 009/027); o
Markdown é o formato *going-forward* do SyntaxMesh (ADR 026), entregue na Fase
13 como `MarkdownFactory implements RichTextFactory`.

As duas fábricas produzem o **mesmo** `RichTextIntermediate`, consumido por
`to_s`/`to_html`/`to_markdown` e pelo pipeline de relatórios da Fase 14 sem
distinção (seam `newRichText(..., format)` estabelecido em 14C.5.1). Falta
apenas a **gramática** para o usuário declarar campos customizados em
Markdown: hoje `markdown Claim "Claim"` dentro de `extend` é erro de sintaxe.

## Decisão

1. **Novo tipo `markdown` em `extend`** (extensão aditiva, sem oracle `tj3`):
   padrão `["_markdown", "!extendId", "$STRING", "!extendOptionsBody"]` em
   `extendAttributes` (`parser/rules/scenario.ts`), espelhando o padrão
   `richtext`.
2. **O nome do tipo é o dialeto.** Não existe `format markdown` por atributo
   dinâmico; `richtext` continua o default histórico.
3. **`AttributeType.Markdown` + `MarkdownAttribute extends RichTextAttribute`**
   (apenas `tjpId = "markdown"`, zero métodos novos). Motivo: `to_tjp` emite
   `this.type.id` e o TJP-export (`tjp-export-re.ts`) escreve a declaração de
   `extend` via `objClass.tjpId` — sem tipo/classe próprios o round-trip
   exportaria `richtext` e re-parseria Markdown como MediaWiki.
4. **Valor criado em parse-time** com `pr.newRichText(text, sfi, null,
   "markdown")` — o pipeline de relatórios **não muda** (D4 da especificação).
5. **Fix pré-requisito (fidelidade, ADR 011):** `richtext` em `extend` passa a
   registrar `AttributeType.RichText` (Ruby `extendPropertySetDefinition
   (RichTextAttribute)`), corrigindo o registro atual como `String`.

## Alternativas rejeitadas

- **Tipo `text` com `format markdown`**: confunde tipo com dialeto; o tipo já
  dá a semântica.
- **Guardar o dialeto na instância do `RichTextIntermediate`**: o RTI não tem o
  campo; mexeria nas Fases 12/13 por ganho nulo.
- **Detecção automática de sintaxe**: ambígua, não determinística.
- **Nova diretiva `markdownextend`**: fragmenta o namespace do `extend`.

## Consequências

### Positivas
- Extensão aditiva; `.tjp` existentes idênticos; goldens não mudam (caso é
  fixture de extensão, padrão 10-C).
- Reuso total de `RichTextIntermediate` e do pipeline de reports (Fase 14).
- Alinha com ADR 026 (Markdown going-forward) e ADR 027 (defaults de reports).
- Round-trip TJP-export correta para os dois dialetos.

### Negativas / Riscos
- Dois tipos (`richtext`, `markdown`) com o mesmo contrato de valor: uma
  entrada a mais no enum `AttributeType` e nos dois switches de
  `attribute-definition.ts`. Aceito (mínimo).
- O fix do `richtext` (item 5) muda o tipo registrado de `String` para
  `RichText` — comportamento fiel ao Ruby, mas pode ajustar snapshots; a
  implementação corrige-se contra o Ruby, nunca o teste.

### Neutras
- `markdown` já é keyword canônica i18n (entregue em C3.9) — sem trabalho novo.
- Atributos internos (`note`, `details`, `unitprice`...) permanecem `richtext`
  por default; migração fica a cargo do usuário.
- Interação com report `format markdown`: reparse identity do `inputText`
  (verificação 14C.19.3), sem mudança à semântica de 14C.5.

## Referências

- Especificação: `docs/syntaxmesh/fases/fase-10-complemento3.md`
- Tarefas: Bloco C5 (`fase-10-complemento-tarefas.md`), 14C.19
  (`fase-14-relatorios-complemento-tarefas.md`)
- ADRs relacionados: 009, 011, 026, 027
- Ruby: `TjpSyntaxRules.rb:1250-1360`, `Attributes.rb:RichTextAttribute`
