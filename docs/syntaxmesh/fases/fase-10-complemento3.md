# Fase 10 Complemento 3 — Tipo `markdown` em `extend` (extensão SyntaxMesh)

> **Arquivo:** `docs/syntaxmesh/fases/fase-10-complemento3.md`
> **Tipo:** especificação de extensão (fora do escopo original do TJ; convenção `README.md`)
> **Fase âncora:** Fase 10 (Parser) — gramática de `extend`; consumo na Fase 14 (Relatórios)
> **Tarefas:** Bloco **C5** em `fase-10-complemento-tarefas.md` + seção **14C.19** em `fase-14-relatorios-complemento-tarefas.md`
> **ADR:** 039 (`decisoes/039-extend-markdown.md`) — número livre após a reserva 033–035 e a cadeia 036–038
> **Status:** PLANEJADA (2026-11-06) — tarefas decompostas, nada implementado
> **Fonte Ruby:** `TjpSyntaxRules.rb:1250-1360` (`rule_extendAttributes`) — o TJ só tem `richtext`/`text`/`date`/`number`/`reference`; `markdown` é **inventado** (sem oracle `tj3`)
> **Depende de:** Fase 10 (regras `extend*`), Fase 12/13 (`RichTextFactoryImpl`/`MarkdownFactory` — mesma saída `RichTextIntermediate`), Fase 14-C §14C.5.1 (seam de `format` em `newRichText`)
> **Bloqueia:** nada (extensão aditiva); exemplos `examples/extend-markdown.tjp` ficam na entrega

---

## 0. Conciliação com o estado atual do código (análise 2026-11-06)

Este plano substitui o rascunho que vivia em `fase-18-complemento.md` (arquivo órfão,
sem relação com sheets — conteúdo migrado e corrigido aqui). O rascunho continha
caminhos e números obsoletos; o estado **real** verificado no código:

| Ponto | Fato verificado | Consequência |
|---|---|---|
| Onde vive `extend` | Regras `extendAttributes`/`extendOptions`/`extendId` em `parser/rules/scenario.ts:244-390` e `rule_extend*` em `parser/rules/project.ts:286-293,982-1010` — **não** existe `parser/rules/common.ts` para isso | Tarefas apontam `scenario.ts` |
| Seam de dialeto já existe | `ProjectFileParser#newRichText(text, sfi, tokenSet, format)` (14C.5.1) roteia `format: "markdown"` → `MarkdownFactory`, `format: "richtext"` → `RichTextFactoryImpl`; as duas produzem o **mesmo** `RichTextIntermediate` | **Nenhuma mudança no pipeline de reports** é necessária para renderizar |
| Fábricas injetáveis | `richTextFactory`/`markdownFactory` + `setMarkdownFactory` já expostos no parser | Wiring pronto; nada a criar |
| Keyword `markdown` | Já é canônica (`i18n/canonical.ts:127`, `pt-BR.ts`, `es.ts` — entregue em C3.9) | i18n é **verificação**, não desenvolvimento |
| **Divergência pré-existente** | `["_richtext", ...]` em `scenario.ts:309-324` registra o atributo com **`AttributeType.String`** (`StringAttribute`); o Ruby usa `extendPropertySetDefinition(RichTextAttribute)` (`TjpSyntaxRules.rb:1322`) | Corrigir **antes** de adicionar `markdown` (C5.1): hoje o TJP-export declara `text Claim "..."` e `to_tjp` não sai por `RichTextAttribute` |
| Export TJP de `extend` | `tjp-export-re.ts:186-200` escreve o tipo via `objClass.tjpId` (classe, não enum) | Um `MarkdownAttribute extends RichTextAttribute` com `tjpId = "markdown"` faz o round-trip **sem tocar no export** |
| Células de tabela | `report-table-cell.ts:72` trata valor `RichTextIntermediate` por *duck-typing* (`value.to_s?.()`); `table-report.ts:197` tem linha de célula por `AttributeType` | Render já funciona para RTI; falta só a linha de metadados do tipo novo |
| Golden do parser | `tj3` **rejeita** `markdown` em `extend` → o caso novo é fixture de extensão (sem oracle), padrão 10-C | `parser.golden.json` **não muda** |

## 1. Contexto e racional

- `extend` é a forma canônica de atributos dinâmicos do TaskJuggler. O TJ aceita
  `richtext` (MediaWiki), `text`, `date`, `number`, `reference`.
- A Fase 13 entregou `MarkdownFactory implements RichTextFactory`: ambos os
  dialetos produzem o **mesmo** `RichTextIntermediate`, consumido por
  `to_s`/`to_html`/`to_markdown` e pelos relatórios sem distinção de fábrica.
- Portanto um atributo `markdown` em `extend` é **pura extensão de gramática**:
  um padrão novo em `extendAttributes` + um tipo que carregue o dialeto para
  `to_tjp`/export. Nada mais.
- Isso permite escrever notas, descrições e campos customizados em Markdown
  (formato *going-forward*, ADR 026) mantendo `.tjp` existentes (`richtext`)
  intactos — extensão aditiva, compatibilidade total.

## 2. Sintaxe e semântica

```tjp
project "Obra" 2026-01-01 - 2026-12-31 {
  extend task {
    markdown Claim "Claim" [scenariospecific] [inherit]
    richtext Intro "Intro"
  }
}

task "Fundação" {
  Claim -8<-
    **Efetivo:** 15 pedreiros.

    ![Vista](fotos/laje-01.jpg)
  ->8-
}
```

- O valor usa a **mesma gramática do `richtext`** (`$STRING`, incluindo blocos
  `-8<- ->8-`); o que muda é o **dialeto de interpretação do texto**.
- `markdown` produz `RichTextIntermediate` via `MarkdownFactory` no momento do
  `set` (lambda do padrão dinâmico), exatamente como `richtext` produz via
  `RichTextFactoryImpl`.
- As opções `scenariospecific`/`inherit` funcionam igual (código compartilhado
  em `extendAttr`/`extendPropertySetDefinition`).
- O tipo é **ortogonal à entidade**: vale para `extend task/resource/account/
  report/material` (o dispatch de entidade não conhece dialeto).
- **Sem override por campo:** o nome do tipo *é* o dialeto. Não existe
  `format markdown` dentro de `extend` (seria outra diretiva, se um dia).

## 3. Decisões de port

| # | Decisão | Justificativa | Rejeitada |
|---|---|---|---|
| D1 | Novo `AttributeType.Markdown = "markdown"` com classe `MarkdownAttribute extends RichTextAttribute` (`tjpId = "markdown"`, sem métodos novos) | `to_tjp` usa `this.type.id` e o TJP-export usa `objClass.tjpId` — sem um tipo/classe próprios o round-trip exportaria `richtext` e re-parseria Markdown como MediaWiki | Guardar dialeto na instância RTI (RTI não tem o campo; tocaria F12/F13); detecção automática de sintaxe (não determinística) |
| D2 | Valor criado em parse-time com `pr.newRichText(text, sfi, null, "markdown")` | Reusa o seam 14C.5.1; nada de novo nas fábricas | Nova fábrica (duplicaria `MarkdownFactory`) |
| D3 | Corrigir `richtext` de `extend` para `AttributeType.RichText` **na mesma leva** (C5.1) | Fidelidade ao Ruby (regra zero, ADR 011) — é o ombro sobre o qual `markdown` se apoia; deixa o comportamento dos dois dialetos simétrico | Deixar a divergência (o tipo novo nasceria ao lado de um vizinho incorreto) |
| D4 | Relatórios: só **verificação** + linha de metadados em `table-report.ts` | `report-table-cell.ts` já trata RTI por duck-typing; `MarkdownAttribute` é `RichTextAttribute` por herança (todo `instanceof` existente já vale) | Mudar o pipeline de reports (desnecessário) |
| D5 | `markdown` em `extend` **não** entra no golden `parser.golden.json` | O oracle `tj3` rejeita a sintaxe; fixture de extensão em `tests/fixtures/ext/`, padrão 10-C | Golden comparativo com TJ (impossível) |

## 4. Escopo por fase

| Destino | O quê | Onde |
|---|---|---|
| Fase 10-C | Fix do tipo do `richtext` em `extend`; tipo/classe `markdown`; padrão `_markdown` em `extendAttributes`; testes BDD; fixture de extensão | Bloco **C5** de `fase-10-complemento-tarefas.md` |
| Fase 14-C | Reconhecimento do tipo novo em células de tabela (verificação + metadados); round-trip TJP-export; sanificação | Seção **14C.19** de `fase-14-relatorios-complemento-tarefas.md` |
| Docs | ADR 039; exemplo `examples/extend-markdown.tjp` | C5.8 |

## 5. Fora de escopo

- **`format markdown` por atributo dinâmico** (o tipo já é o dialeto — §2).
- **Migrar atributos internos** (`note`, `details`, `unitprice`...) para
  `markdown`: o dialeto deles continua `richtext` por default (ADR 027/14C.5);
  migração fica a cargo do usuário via `extend` ou de fase futura.
- **Deteção automática de dialeto** em strings: rejeitada (D1).
- **Interação report-`format` × atributo-`markdown`**: `rtiForReport`
  (14C.5.7) reconstrói RTI pelo dialeto do **relatório** quando o report usa
  `format markdown` — para um atributo já markdown isso é reparse identity do
  `inputText`; verificar por teste em 14C.19.3, sem mudar a semântica de 14C.5.
- Sheets (18), templates (23), CLI (24): consomem o recurso via reports, nada específico aqui.

## 6. Riscos e pontos de atenção

1. Enum novo em `AttributeType` → atualizar os **dois** switches de
   `attribute-definition.ts` (`~245` nome Ruby e `~478` construtor). O golden
   `attribute-definitions` só cobre atributos padrão do TJ (não user-defined) —
   sem re-baseline esperado; confirmar (C5.2).
2. `extendId` valida maiúscula inicial (`scenario.ts:374-380`); o padrão novo
   reusa `!extendId`, nada a fazer — cobrir no teste de erro.
3. C5.1 (fix `richtext`) pode alterar snapshots de teste/integração que hoje
   dependem do tipo `String` do atributo estendido; rodar a suíte completa e
   ajustar **implementação contra o Ruby**, nunca o teste (baseline congelado).
4. Scanner: `markdown` já é keyword registrada, então em `extend` ela tokeniza
   `_markdown` (não `$ID`). Isso significa que **hoje** `markdown Claim "..."`
   falha como erro de sintaxe — comportamento correto pré-extensão; confirmar.

## 7. Referências cruzadas

- ADR 039 (esta extensão); ADR 009 (RichText mantido), ADR 026 (Markdown
  going-forward), ADR 027 (reports/default-richtext), ADR 011 (port fiel).
- Ruby: `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb:1250-1360`;
  `Attributes.rb:RichTextAttribute`.
- Código: `packages/core/src/parser/rules/scenario.ts`,
  `packages/core/src/parser/project-file-parser.ts` (`newRichText`,
  `extendPropertySetDefinition`), `packages/core/src/attributes/
  {attribute-type.ts, attribute-definition.ts, rich/rich-text-attribute.ts}`,
  `packages/core/src/reports/{report-table-cell.ts, table-report.ts, tjp-export-re.ts}`.
- Precedentes de formato de spec: `fase-10-complemento1.md`, `fase-10-complemento2.md`.

## 8. Critérios de aceite

- [ ] `extend <entidade> { markdown Nome "Rótulo" }` parseia nas três entidades clássicas (task/resource/account) + `scenario specific`/`inherit` funcionam.
- [ ] `richtext` em `extend` passa a registrar `AttributeType.RichText` (fiel ao Ruby), sem regressão nos testes existentes.
- [ ] `to_s` = texto puro renderizado; `to_html` = HTML sanitizado do pipeline 13.5; `to_markdown` disponível.
- [ ] TJP-export declara `markdown Nome "Rótulo"` e o round-trip re-parseria no mesmo dialeto.
- [ ] Coluna de report com atributo `markdown` renderiza sem mudança no pipeline (verificação 14C.19).
- [ ] `parser.golden.json`/`attribute-definitions.golden.json` byte-idênticos (extensão sem oracle).
- [ ] ADR 039 aceita; suíte completa verde; `deno task tests` + `check:stubs` verdes.
