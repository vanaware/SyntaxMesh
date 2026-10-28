# ADR 025 — RichText e function handlers

> **Status:** ✅ Aceito
> **Data:** 2026-10-28
> **Autores:** Qwen Code

## Resumo

O `RichText` é o subsistema que interpreta o dialeto de **MediaWiki markup**
usado pelo TaskJuggler em `note`, `headline`, `caption`, `summary`, `details`,
etc. Decisões centrais do port:

1. **Reuso do FSM da Fase 10** — `RichTextParser extends TextParser` e
   `RichTextScanner extends Scanner`; não se recria um parser do zero.
2. **`RichText.@@parser` é singleton** — uma instância é reaproveitada via
   `reuse(rti, sectionCounter, tokenSet)` a cada parse.
3. **Function handlers** — o markup pode invocar funções embutidas
   (`[[query:…]]`, `[[report:…]]`, `[[navigator:…]]`, `[[example:…]]`), cada uma
   implementada como subclasse de `RichTextFunctionHandler`.

> **Nota de numeração:** o plano e o arquivo de tarefas da Fase 12 referenciam
> esta decisão como `ADR 024`, mas o slot 024 foi alocado ao ADR de
> *expressões lógicas sem precedência* (Fase 11). O README já reservava o
> **025** para *RichText e function handlers*; usamos 025.

## Contexto

Os `.tjp` originais do TaskJuggler carregam markup MediaWiki dentro de
atributos de texto. A compatibilidade com esses arquivos é requisito (ADR 009 —
RichText mantido, Markdown futuro). Uma vez que o parser de markup de alto
nível (Fase 10) já entrega um autômato de estados (`TextParser` + `Scanner` +
`Pattern`/`Rule`/`State`), faria sentido reaproveitá-lo para o RichText, trocando
apenas as regras e os tokens.

O RichText também precisa renderizar em três formatos (`to_s` texto puro,
`to_tagged` marcado, `to_html` árvore de elementos). O `to_html` produz uma
árvore de `XMLElement` — classe que só nasce na Fase 17. E as funções embutidas
introduzem um acoplamento delicado: `RTFQuery` depende da `Query` (Fase 11, já
pronta), mas `RTFReport`/`RTFReportLink`/`RTFNavigator` dependem do pipeline de
relatórios (Fase 14, ainda não existe).

## Decisão

- **RichText mantido para compatibilidade com `.tjp`** (reforça ADR 009). Não
  substituir por Markdown nesta fase; o Markdown (Fase 13) coexiste como formato
  going-forward.
- **`RichTextParser extends TextParser` e `RichTextScanner extends Scanner`** —
  máximo reuso do FSM da Fase 10; apenas regras/tokens próprios.
- **Parser singleton com `reuse`** — espelha `RichText.@@parser` do Ruby; o
  estado (`sectionCounter`, `tokenSet`, pilhas) é resetado a cada `reuse`.
- **`to_html` retorna a interface `XMLElementLike`**, não `XMLElement` concreto.
  `SimpleXMLElement` é a implementação mínima desta fase; a Fase 17 substitui
  pela classe real que também implementa `XMLElementLike`, sem quebrar chamadas.
- **`RichTextFunctionHandler` abstrata + subclasses** (`RTFQuery`, `RTFReport`,
  `RTFReportLink`, `RTFNavigator`, `RichTextFunctionExample`), com
  `RTFWithQuerySupport` como base das que consomem `Query`.
- **`RTFReport`, `RTFReportLink` e `RTFNavigator` são stubs nesta fase** —
  lançam `NotYetImplementedError` apontando para a Fase 14, onde o `Report` e o
  `Navigator` reais existem. `RTFQuery` é funcional (usa a `Query` da Fase 11).
- **`RichTextFactory`** substitui, ao final da Fase 12, o stub usado pelo
  `ProjectFileParser` durante a Fase 10; o injeta via `setRichTextFactory`. Nada
  na Fase 10 precisa mudar — só passa a produzir `RichTextIntermediate` reais.

## Alternativas consideradas e rejeitadas

- **Substituir RichText por Markdown agora.** Rejeitada: quebraria todos os
  `.tjp` existentes e os golden tests de compatibilidade (ADR 009/011).
- **Parser RichText próprio, independente do `TextParser`.** Rejeitada:
  duplicaria o FSM já validado na Fase 10 e violaria o princípio de reuso / port
  fiel (ADR 011).
- **Fazer `to_html` retornar `string` HTML.** Rejeitada: o `XMLDocument`/report
  (Fase 14/17) precisa da **árvore** de elementos para manipulação; por isso
  retorna `XMLElementLike`.

## Consequências

### Positivas

- Reuso máximo do `TextParser`/`Scanner`; superfície de bugs reduzida.
- `.tjp` com markup continuam compatíveis (objetivo da ADR 009).
- `XMLElementLike` permite entregar RichText **sem** a Fase 17, com substituição
  limpa depois.

### Negativas / Riscos

- Acoplamento com Fase 10 (parser) e Fase 11 (`Query`): mudanças neles afetam o
  RichText.
- Os stubs `RTFReport`/`RTFReportLink`/`RTFNavigator` deixam `[[report:…]]` etc.
  inoperantes até a Fase 14 — documentado e testado (lançam erro claro).
- Singleton do parser exige `reuse` correto; estado compartilhado entre chamadas
  é risco mitigado por testes isolados.

### Neutras / Observações

- `<fcol:red>`, `[[File:…]]`, `[[query:…]]` são extensões TJ além do MediaWiki
  padrão — portadas fielmente.
- `generateIntermediateFormat` pode retornar `null` para markup inválido; o
  `RichTextFactory` converte isso em erro do `MessageHandler`.

---

**Referências:** ADR 009, ADR 011, ADR 021 (FSM do TextParser), ADR 023
(expressões lógicas). Fontes Ruby:
`docs/taskjuggler/lib/taskjuggler/RichText.rb` + `RichText/*.rb`.
Plano: `docs/syntaxmesh/fases/fase-12-richtext.md`.
