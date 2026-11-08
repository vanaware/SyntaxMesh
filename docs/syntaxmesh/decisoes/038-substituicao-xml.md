# ADR 038 — Substituição de XML/HTML/ICalendar/Painter mínimos

> **Status:** ✅ Aceito
> **Data:** 2026-11-04
> **Autores:** Qoder

## Resumo

As Fases 12, 14 e 15 operaram com **implementações mínimas** de quatro
subsistemas de saída — `SimpleXMLElement`, `html-shell`, `ICalendar` de
`reports/` e `PainterMin` — porque os geradores reais pertencem à Fase 17.
Um **quinto** mínimo foi descoberto ao abrir a fase: `reports/xml-node.ts`
(Fase 14.18), que reexporta `XMLElement`, `XMLDocument`, `XMLNamedText`,
`XMLComment` e `XMLBlob` com os **mesmos nomes** dos ports reais. A Fase 17
entrega os ports completos de `XMLElement.rb`, `XMLDocument.rb`,
`HTMLDocument.rb`, `HTMLElements.rb`, `ICalendar.rb` e `Painter/*.rb` e
**substitui** os mínimos, removendo-os. A interface `XMLElementLike`
(Fase 12) **permanece** como contrato entre o modelo e a serialização: o
`XMLElement` real a implementa, então a troca é transparente para
RichText, reports e Gantt.

> **Nota de numeração:** o plano `fase-17-html-xml.md` e o arquivo de tarefas
> pediam "ADR 029". O 029 já foi consumido pela Fase 16
> (`029-journal-alertlevel.md`, 2026-11-03) e 028 é o Gantt (Fase 15).
> Pelas regras do `decisoes/README.md` (*nunca renumerar ADRs existentes;
> usar o próximo número livre*), esta decisão recebe o **038** — 033–037
> estão reservados (Fases 23/24/22/18). Os docs da Fase 17 foram corrigidos.

## Contexto

### O que cada fase antecipou

| Mínimo | Nascimento | Omissão conhecida |
|---|---|---|
| `SimpleXMLElement` (`src/richtext/xml-like.ts`) | 12.1 | Sem indentação, sem `XMLText`/`XMLComment`/`XMLBlob` como nós próprios; `escape` de atributo usa `&quot;` (o Ruby usa `\"`); lista de *void elements* é a do HTML5, não a do Ruby |
| `xml-node.ts` (`src/reports/xml-node.ts`) | 14.18 | Mesmos cinco nomes do port real; auto-fecha **qualquer** elemento vazio (o Ruby só fecha os `selfClosing`), não ordena atributos, `push()` em vez de `<<`; consumido por `msp-xml-re.ts` e `niku-report.ts` |
| `createHtmlShell` (`src/richtext/html-shell.ts`) | 12.9/12.10 | Só `doctype` html5, comentário fixo, sem `XMLDocument`, sem `xmlns`/XHTML, sem `metaTags`/`blob` |
| `ICalendar` (`src/reports/i-calendar.ts`) | 14.19.1 | Subconjunto VTODO/VEVENT/VJOURNAL; sem `Person` rico, sem `PRODID`/`CREATED` fiéis, sem a estrutura de classes do Ruby |
| `PainterMin` (`src/painter-min.ts`) | 14.22.1 | ~8 cores nomeadas, sem `Color` HSV, sem `FontMetrics`/kerning, sem `Group`/`Primitives` como no Ruby |

### Como o TaskJuggler realmente funciona

`XMLElement.rb` define a árvore e a **serialização com indentação**:
`to_s(indent)` ordena atributos (`keys.sort`), emite `/>` quando
`selfClosing` e sem filhos, e insere `\n` + indentação **entre filhos que
não são `XMLText`**, só quando há mais de um filho e o buffer termina em
`>`. A indentação é de **uma SPACE por nível** (`' ' * indent`), não duas.
As subclasses `XMLText`, `XMLNamedText`, `XMLComment` (canonicaliza `--`
em `-\-`) e `XMLBlob` (reindent after `\n`) sobrescrevem `to_s`.
`XMLDocument` é um contentor de topo com `<<`, `to_s` e `write`.
`HTMLElements.rb` gera por `class_eval` uma classe em MAIÚSCULAS por tag
(25 tags; 8 delas *self-closing*). `HTMLDocument.rb` herda de
`XMLDocument`, monta o `doctype` (html5 ou os 3 XHTML) e `generateHead`.
`ICalendar.rb` é RFC 5545: `Person`, `Component` base, `Todo`/`Event`/
`Journal`, `dateTime` em UTC, `foldLines` a 75 octetos e CRLF.
`Painter/*.rb` é uma biblioteca de desenho SVG com `Color` (155 cores
nomeadas + HSV), `Points`, `SVGSupport`, `Element`, `Group`,
`BasicShapes`, `Text`, `Primitives` e `FontMetrics`/`FontMetricsData`/
`FontData` (métricas reais com kerning, para o `Painter` calcular largura
de texto sem raster).

## Decisão

1. **Novos módulos, fielmente portados**, em `packages/core/src/`:
   - `xml/xml-element.ts` — `XMLElement`, `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`.
   - `xml/xml-document.ts` — `XMLDocument`.
   - `html/html-elements.ts` — mapa estático de classes por tag.
   - `html/html-document.ts` — `HTMLDocument extends XMLDocument`.
   - `ical/person.ts`, `ical/component.ts`, `ical/todo.ts`, `ical/event.ts`, `ical/journal.ts`, `ical/i-calendar.ts`.
   - `painter/` — `color.ts`, `points.ts`, `svg-support.ts`, `element.ts`, `group.ts`, `basic-shapes.ts`, `text.ts`, `primitives.ts`, `painter.ts`, `font-metrics.ts`, `font-metrics-data.ts`, `font-data.ts`.
2. **`XMLElement implements XMLElementLike`.** Como o Ruby não expõe
   leitores públicos para `@name`/`@attributes`, o `XMLElement` TS mantém os
   campos fiéis (`name`, `attrs`, `selfClosing`, `children` — `attrs` é o
   nome público equivalente a `@attributes`) e expõe `tag` como *getter* de
   compatibilidade com a interface.
   `toHTML()` é adicionado como alias de `to_s(0)` — **é o único acréscimo
   público ao API do Ruby**, exigido pelo contrato `XMLElementLike`.
3. **Os mínimos são removidos**, não mantidos em paralelo:
   `SimpleXMLElement` + `RawHTMLNode`/`createComment`/`createBlob`/
   `createText` e `reports/xml-node.ts` (17.12), `html-shell` (17.13),
   `reports/i-calendar.ts` (17.14), `painter-min.ts` (17.15). A interface
   `XMLElementLike` é movida para `xml/xml-element-like.ts` e continua
   reexportada de `richtext/xml-like.ts` para não quebrar os ~25 importadores.
   Enquanto `xml-node.ts` existir, o `export *` de `src/xml/mod.ts` no
   `src/mod.ts` top-level **não pode** abrir (choque de nomes); por isso os
   itens 17.1.5.3/17.2.8 ficam adiados para dentro da 17.12.
4. **Os contratos de saída são mantidos onde o Ruby manda.** A substituição
   segue o Ruby inclusive quando o Ruby é estranho (Categoria B/C): escape
   de `"` como `\"` em atributos, `escape` ignorando o parâmetro `quotes`,
   indentação de 1 espaço, `generateHead` devolvendo o elemento `<html>`
   (porque `XMLElement#<<` devolve `self`). Mudanças de whitespace/escaping
   no HTML dos relatórios são aceitas como **aproximação do oracle**, não
   como regressão — é isso que os golden tests da 17.16 passam a medir.
5. **E/S no browser.** `XMLDocument.write('.')` devolve a string (equivalente
   ao `$stdout` do Ruby); qualquer outro nome de arquivo fica com o hook de
   escrita injetado (Fase 19 / ADR 037) — o core não toca em `Deno`/`fs`.
6. **`Painter` gera SVG**, nunca Canvas, e `FontData` é portado como dados
   (constantes), não como gerador.

## Consequências

### Positivas
- Uma única implementação de árvore XML/HTML para RichText, reports, Gantt,
  MSPDI/Niku e Painter — fim das divergências *mínimo vs. real*.
- Saída byte-a-byte compatível com `tj3` para XML/HTML/iCalendar, medida por
  golden tests próprios (17.16).
- `FontMetrics` dá largura/altura de texto determinística ao `ChartPlotter`
  e a futuros gráficos, sem depender de raster.
- Remove dívidas explícitas registradas nas Fases 12/14/15.

### Negativas / Riscos
- Refatoração de imports em ~35 arquivos; risco de quebrar goldens de
  reports. Mitigação: substituição em subfases separadas (17.12–17.15), cada
  uma fechada com a suíte completa.
- `escape` de atributo passa a produzir `\"` em vez de `&quot;`. Nenhum
  golden atual contém `&quot;`, então o risco é medido e não presumido.
- `FontData.rb` tem ~1000 linhas de dados; cópia errada é silenciosa.
  Mitigação: teste de soma/amostra (`averageWidth`, larguras conhecidas).

### Neutras / Observações
- O plano numerava as subfases como `21.X` (resíduo de renumeração) — a
  verificação 17.17.9 corrige para `17.X`.
- `XMLElement.new(nil)` com atributos lança; o construtor base com `name`
  nulo só é útil via subclasses que sobrescrevem `to_s`.
- Referências: `docs/taskjuggler/lib/taskjuggler/{XMLElement,XMLDocument,HTMLDocument,HTMLElements,ICalendar,Painter}.rb`,
  `docs/taskjuggler/lib/taskjuggler/Painter/*.rb`.
- Fases impactadas: 12 (RichText), 14 (reports/iCal/trace), 15 (Gantt),
  20/21 (UI e compatibilidade, que consomem esta fase).
- Nota 2026-11-07 (Fase 24, tarefa 24.2.34): `XMLDocument.write` é o hook de
  escrita do documento; na fronteira `execute` ele só entrega/persiste o que
  o consumidor pediu — nome `"."` devolve a string do documento, qualquer
  outro nome é no-op com aviso **em inglês** (`xml_document_write_noop`).
  Escrita em disco/OPFS é do consumidor (ADR 037, aditamento v2.1).

---

**Status:** Aceito
**Data:** 2026-11-04
**Autor(es):** Qoder
