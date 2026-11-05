# Fase 17 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-17-html-xml.md`
> **Status:** ✅ Concluída (iniciada 2026-11-04, fechada 2026-11-04)
> **Total:** ~180 tarefas
> **Concluídas:** 17.0 (ADR 038), 17.1–17.17 (XML, HTML, iCalendar, Painter/Primitives/BasicShapes/Text/Painter/FontMetrics, substituições SimpleXMLElement→XMLElement, html-shell→HTMLDocument, ICalendar mínimo→real, Painter mínimo→real, goldens HTML/XML/iCal e verificação final com smoke test)
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{XMLElement,XMLDocument,HTMLDocument,HTMLElements,ICalendar}.rb` + `Painter/*.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

Esta fase **substitui implementações mínimas** das Fases 12, 14 e 15 por versões completas. A ordem importa:

1. **Bloco A (XML)** — `XMLElement` + subclasses + `XMLDocument`.
2. **Bloco B (HTML)** — `HTMLElements` + `HTMLDocument`.
3. **Bloco C (ICalendar)** — `Person`, `Component`, `Todo`, `Event`, `Journal`, `ICalendar`.
4. **Bloco D (Painter)** — `Color`, `Points`, `SVGSupport`, `Element`, `Group`, `Primitives`, `BasicShapes`, `Text`, `Painter`, `FontMetrics`, `FontData`.
5. **Bloco E (substituição)** — Trocar `SimpleXMLElement`, `HTMLDocument` mínimo, `ICalendar` mínimo, `Painter` mínimo.
6. **Bloco F (golden)** — validação end-to-end.
7. **Bloco G (verificação)** — fecha a fase.

**Substituição transparente:** a interface `XMLElementLike` (Fase 12) permanece. `XMLElement` real a implementa. Imports atualizados arquivo por arquivo.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 012–022** — Fases 2–10 (contexto).
- **ADR 023** — Expressões lógicas sem precedência (Fase 11).
- **ADR 024** — RichText e function handlers (Fase 12).
- **ADR 025** — Markdown going-forward (Fase 13).
- **ADR 026** — Reports browser-only (Fase 14).
- **ADR 027** — Gantt HTML+CSS (Fase 15).
- **ADR 028** — Journal e AlertLevel (Fase 16).
- **ADR 038** — Substituição de XML/HTML/ICalendar/Painter mínimos (**criado nesta fase**).

### Convenções CRÍTICAS

- **`XMLElement` substitui `SimpleXMLElement`** (Fase 12).
- **Interface `XMLElementLike` permanece.**
- **`XMLText` escapa `<`, `>`, `&`. Não escapa `"`.**
- **`XMLElement` attrs escapam `&`, `"`.**
- **`XMLComment` canonicaliza `--` em `-\-`.**
- **`HTMLDocument` 4 doctypes** (html5, strict, transitional, frameset).
- **`HTMLElements` map estático.** Não usar `class_eval`.
- **`ICalendar.foldLines`** com `LINELENGTH = 75`.
- **`dateTime` sempre em UTC.**
- **`Color.hsvToRgb`** com `hi = (h/60).floor % 6`.
- **`Painter` gera SVG.** Sem Canvas.
- **`FontData.rb` copiado byte-a-byte.**
- **`FontMetrics.width`** aplica kerning.
- **`SVGSupport.valuesToSVG`** com `font_size` → `font-size` + `pt`.
- **Substituições em subfases separadas** (17.12–17.15).
- **Golden tests byte-a-byte** — normalizar apenas line endings.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar Canvas (só SVG).
- ❌ Não usar `class_eval` em TS.
- ❌ Não quebrar a interface `XMLElementLike`.
- ❌ Não modificar `RichTextElement` (Fase 12) além dos imports.
- ❌ Não tocar em `GanttChart` (Fase 15) além dos imports.
- ❌ Não reinventar `Painter` com SVG diferente do Ruby.
- ❌ Não usar `Proxy`.
- ❌ Não usar `FontData.rb` como gerador — copiar dados.
- ❌ Não alterar saída de reports (Fase 14) — apenas refatorar imports.

---

## 📋 Registro de progresso

> Registro das micro-etapas efetivamente executadas (teste a cada execução).
> Convenção: cada linha = uma micro-subfase, com data, arquivos reais e a
> evidência de verificação (contagem de testes / saída de gate). Divergências
> de caminho ou de comportamento em relação ao plano são registradas aqui.

| Subfase | Estado | Evidência |
|---|---|---|
| 17.0 — ADR 038 | ✅ 2026-11-04 | `decisoes/038-substituicao-xml.md` (Resumo/Contexto com tabela dos 4 mínimos/6 Decisões/Consequências); `decisoes/README.md` ganhou a linha 038 e a nota de reserva foi corrigida (029 já tem arquivo desde a Fase 16). **Numeração:** plano e tarefas pediam `ADR 028`/`ADR 029`, ambos consumidos; usamos o próximo livre **038** (033–037 reservados). Também corrigida a numeração residual `21.X` → `17.X` no plano (§5, §8, §10). |
| 17.1 — XMLElement + subclasses | ✅ 2026-11-04 | `src/xml/xml-element.ts` + `tests/xml/xml-element_test.ts`; gates: `deno fmt`/`deno check` limpos, `deno test packages/core/tests/xml` → **9 passed (77 steps) / 0 failed**; suíte completa 572 passed (5637 steps). **Divergências do plano resolvidas contra o Ruby real** (oracle `ruby` executado ao vivo, não presumido): (a) `escape` emite `\"` para `"` — **não** `&quot;` — e **não** escapa `<`/`>` em atributo; o parâmetro `quotes` é ignorado pelo Ruby (Categoria C, preservado atrás de `compat.keepRubyBugs`); (b) indentação é **1 espaço por nível** (`' ' * indent`), não 2; (c) o `\n` antes do filho só sai quando `children.size > 1 && !child.is_a?(XMLText) && out[-1] == '>'`; (d) chaves de atributo são **ordenadas** (`keys.sort`); (e) `to_s` com `name == null` levanta `TypeError`; (f) `XMLText.new('')` é legal (`''` é truthy em Ruby) — só `nil`/`undefined` levantam. |
| 17.2 — XMLDocument | ✅ 2026-11-04 | `src/xml/xml-document.ts` + `tests/xml/xml-document_test.ts`; gates: `deno check` limpo, `deno test packages/core/tests/xml` → **13 passed (95 steps) / 0 failed**. `XMLDocument#<<` achata (`flattenRuby` próprio — `Array.flat(Infinity)` com tipo recursivo disparava TS2589) **sem validar** e **sem compactar** `null`; `to_s` espelha `nil.to_s == ''` do Ruby. `write('.')` devolve a string; outro nome é no-op com warning (precedente `CSVFile.write`, ADR 027). |
| 17.1.5.3 / 17.2.8 — re-export em `mod.ts` | ⏸️ adiado para 17.12 | Criado `src/xml/mod.ts` como ponto de entrada do Bloco A. O `export *` no `src/mod.ts` top-level está **bloqueado** por `src/reports/xml-node.ts` (Fase 14.18), que exporta os **mesmos cinco nomes** (`XMLElement`, `XMLDocument`, `XMLNamedText`, `XMLComment`, `XMLBlob`) via `reports/mod.ts` — uma **5ª duplicata mínima não prevista** no plano. Decisão: migrar `msp-xml-re.ts` + `niku-report.ts` para as classes reais e apagar `xml-node.ts` dentro da 17.12, antes de abrir o re-export. Registrado no ADR 038. |
| 17.3 — HTMLElements | ✅ 2026-11-04 | `src/html/html-elements.ts` + `tests/html/html-elements_test.ts`; `deno check` limpo, `deno test tests/html tests/xml` → **16 passed (108 steps) / 0 failed**. Oracle Ruby confirmado: `DIV.new({'class'=>'foo'}).to_s` = `"<div class=\"foo\"></div>"`, `BR.new.to_s` = `"<br/>"`, `DIV.new { BR.new }` = `"<div><br/></div>"` — logo o `super` do Ruby **encaminha o bloco**, e a fábrica TS faz o mesmo. `htmlTags` (25) e `closureTags` (9) mantidos integralmente: seis tags de closure (`area`, `base`, `basefont`, `input`, `img`, `link`) **não** viram classe no Ruby — a fábrica é genérica, mas só as 25 são exportadas. Acréscimo: `Object.defineProperty(cls,'name')` dá `DIV.name === 'DIV'`. |
| 17.4 — HTMLDocument | ✅ 2026-11-04 | `src/html/html-document.ts` + `src/html/mod.ts` + `tests/html/html-document_test.ts`; `deno check` limpo, suíte local → **20 passed (125 steps) / 0 failed**. Expectativas **copiadas da saída literal do Ruby** (`HTMLDocument.rb` executado com `AppConfig.appName='tj3'`), incluindo: bloco do construtor entra **antes** do doctype; comentário `This file has been generated by <appName> v<version>`; attrs ordenados (`lang`, `xml:lang`, `xmlns`); `<head>` indentado com **2 espaços** nos filhos e **1** no `</head>` (consequência da regra de 1 espaço/nível do 17.1); `generateHead` devolve o `<html>`; `docType` inválido levanta `Unsupported docType` já com o prolog empurrado. **Correção de fidelidade no 17.2** descoberta aqui: o `write` do Ruby usa `f.puts`, que acrescenta `\n` só quando falta — `write('.')` difere de `to_s()`. Testes do 17.2 atualizados (3 novos `it`). |
| 17.5 — ICalendar + Component + Person | ✅ 2026-11-04 | `src/ical/{person,component,i-calendar,mod}.ts` (mais `todo/event/journal.ts`, ver nota 17.6) + `tests/ical/{component,i-calendar}_test.ts`; `deno check` limpo, `deno test tests/ical` → **12 passed (42 steps) / 0 failed**. Achei no Ruby real e replico: `@type` vem do **nome da classe** (`Todo` → `VTODO`/`UID:…-TODO`) — seguro porque o build roda com `minify:false`+`keepNames:true`; `description=''` **imprime** `DESCRIPTION:` (string vazia é truthy), enquanto RELATED-TO não é escapado; `foldLines` **não conta** o caractere que provoca a quebra nem o espaço de continuação (Categoria C) — verificado: `"A"×100` → 75+25, `"😀"×20` → 18+2, `8+66×'a'+😀` → quebra antes do emoji. **Divergência**: `foldLines` é `private` no Ruby e virou função de módulo exportada para ser testável. **Achado crítico sobre `TjTime`**: o `TjTime.new.utc` do Ruby **preserva o instante** (só troca a zona), mas o nosso `TjTime.utc()` **desloca** o epoch; como `dateTime` já formata com `'UTC'`, chamar `.utc()` deslocaria duas vezes — por isso **não** chamamos (mesma escolha do mínimo da Fase 14.19.1). |
| 17.6 — Todo, Event, Journal | ✅ 2026-11-04 | `tests/ical/todo-event-journal_test.ts`; suíte local → **15 passed (57 steps) / 0 failed** (suíte completa com o Bloco D: ver linha 17.7). **Os três arquivos de código foram escritos no passo 17.5**, porque há dependência circular de módulos (`ICalendar` agrega `Todo[]/Event[]/Journal[]` e eles chamam `ical.addX(self)` no próprio construtor) — resolvida com `import type` dos dois lados; registrado aqui como divergência de ordem. Comportamentos pinados: `Todo` default `priority 0` / `percentComplete -1` (linha `PERCENT-COMPLETE:-1` sai mesmo assim); `< 100.0` → `DUE`, `>= 100` → `COMPLETED`; `Event` default `priority 1` e `TRANSP:TRANSPARENT`; `Journal` não acrescenta nada (o `super` sem bloco). |
| 17.7 — Color, Points, SVGSupport | ✅ 2026-11-04 | `src/painter/{color,points,svg-support,mod}.ts` + `tests/painter/*_test.ts`; gates: `deno fmt`/`deno lint`/`deno check` limpos, `deno test tests/painter` → **13 passed (58 steps) / 0 failed**. Re-export **já aberto** em `src/mod.ts` (17.7.3.5): diferente de XML/HTML/iCal, nenhum nome de `painter/` colide com `painter-min.ts`, então o Bloco D não fica bloqueado para a 17.15. Achados do oráculo Ruby: `NamedColors` tem **147** (não 155) e é **Symbol-keyed** — `Color.new('red')` levanta `RuntimeError` no Ruby; aceitamos string (Categoria A). `hsvToRgb` **não** trunca `v` na tabela final (`(40,200,240.5,'hsv') → [240.5,177,51]`, Categoria C); o **4º argumento é ignorado** (o `:hsv` vem do `ChartPlotter`); faixas assimétricas (RGB `< 256`, HSV `<= 255`, hue `< 360`) e `ArgumentError` **sem mensagem** na aridade errada. `Points#to_s` termina **com espaço** (`"1,2 3,4 "`) — o plano dizia sem; `valuesToSVG` mantém ordem de inserção (não ordena, ao contrário de `XMLElement`) e só `font_size` ganha `pt`. |
| 17.8 — Element + Group | ✅ 2026-11-04 | `src/painter/{element,group}.ts` + `tests/painter/{element,group}_test.ts`; gates `fmt`/`lint`/`check` limpos, `deno test tests/painter` → **19 passed (81 steps) / 0 failed**. Oracle (`.tmp/element_ruby_check.rb`): `Element.new('foo', [:a,:b], {a:1,b:2}).to_svg.to_s` = `"<foo a=\"1\" b=\"2\"></foo>"` (tag **não** self-closing, attrs **ordenados** pelo 17.1); `@text=''` é truthy → entra como `XMLText` vazio; `Element` levanta `"Unsupported attribute c"` enquanto `Group` levanta `"Unsupported attribute bogus. Use one of fill, font_family, font_size, stroke, stroke_width."`; `Group` **aliasa** `@values` (mutar o hash depois altera o SVG — pinado em teste) enquanto `Element` **copia** chave a chave. **Divergências**: (a) o plano pede `abstract class Element`, mas o Ruby instancia `Element` cru — mantivemos classe concreta; (b) `instance_eval` (bloco de arity 0) não existe em TS — o bloco sempre recebe o grupo (`yield self`, Categoria A); (c) `elements` é `Drawable[]` (`{ to_svg(): XMLElement }`), não `Element[]`, porque o Ruby aninha `Group` dentro de `Group`; (d) `values` tipado `SVGValues` em vez de `Record<string, unknown>`. |
| 17.9 — BasicShapes, Text, Primitives | ✅ 2026-11-04 | `src/painter/{basic-shapes,text,primitives}.ts` (o `basic-shapes.ts` já vinha da 17.8) + refactor de `group.ts` + `tests/painter/{basic-shapes,text,primitives}_test.ts`; gates `fmt`/`check` limpos, `deno test tests/painter` → **29 passed (117 steps) / 0 failed**. Oracle (`.tmp/shapes_ruby_check.rb` + `.tmp/primitives_probe.rb`): cada forma tem tag fixa e lista de attrs exata (`Line` só `StrokeAttrs` → `line(fill)` levanta `"Unsupported attribute fill"`); `Text.new(str, attrs)` põe `str` em `@text`; primitives **mutam o hash `attrs` do chamador** (Ruby `attrs[:x1]=x1`) — Category C replicado e pinado; `polyline` aceita `Point[]` (converte em `Points`) ou `Points`; dois filhos → `\n` + indent de 1 espaço (regra do 17.1). **Decisão de arquitetura**: `Primitives` é classe **abstrata** com `elements` + formas, mas **não conhece `Group`** — `group()` delega a um gancho `protected abstract newGroup()` para quebrar o ciclo `primitives ↔ group` (o único import de `group.ts` em `primitives.ts` é `import type`, apagado em runtime). `Group extends Primitives`; `TextAttrs` mora em `text.ts` e `Stroke/Fill/FillAndStrokeAttrs` em `basic-shapes.ts` para o mesmo motivo (grafo acíclico). |
| 17.10 — Painter | ✅ 2026-11-04 | `src/painter/painter.ts` (+ export no `mod.ts`) + `tests/painter/painter_test.ts`; gates `fmt`/`check` limpos, `deno test tests/painter` → **33 passed (126 steps) / 0 failed**. `Painter extends Primitives` (Ruby `include Primitives`), implementa `newGroup` devolvendo `Group`; `to_svg` = `XMLElement('svg', {width:'…px', height:'…px'}) { children }` — oráculo `.tmp/painter_ruby_check.rb` pinou `PAINTER_EMPTY` = `<svg height="50px" width="100px"></svg>` (height **antes** de width, ordenação do 17.1), 1 filho sem `\n`, 2 filhos com `\n`+indent, group e group aninhado. **Divergências**: (a) Category A — `instance_eval` (arity 0) inexistente em TS, bloco sempre recebe o `Painter` (`yield self`), como em `Group`; (b) Category B/C — `"#{@width}px"` com Float inteiro dá `"50.0px"` no Ruby mas `"50px"` em TS (`String(50.0)`); `100.5`→`"100.5px"` em ambos; `ChartPlotter` só passa `Integer`, então não aparece nos goldens reais; (c) `elements` vem da base `Primitives` (não re-declarado). |
| 17.11 — FontMetricsData, FontData, FontMetrics | ✅ 2026-11-04 | `src/painter/{font-metrics-data,font-data,font-metrics}.ts` (+ exports no `mod.ts`) + `tests/painter/{font-metrics-data,font-data,font-metrics}_test.ts`; gates `fmt`/`check` limpos, `deno test tests/painter` → **42 passed (155 steps) / 0 failed** (Δ = 9 describes / 29 `it`s). Oráculo `.tmp/fontmetrics_probe.rb`: `height('Arial',12)=17`, `height('Arial',24)=34`, `height('Arial',11)=15`, `width('Arial',12,'Hello')=36`, `('AW')=25` (kerning −0.891), `(' ')=4`, `Arial-Bold 'Hello'=39`, `glyphWidth('A')=15.984`, glifo ausente → `nil`, `averageWidth=0`, 95 glifos / 96 kernings na normal, fonte desconhecida → `ArgumentError "Unknown font 'Times'!"`. **Não-porte**: o construtor Prawn de `FontMetricsData` (leitura de TTF via `Prawn::TTF`, `generateMetrics`) e o dumping de `FontData.rb` não existem no browser (ADR 027/038) — só o modo data-loaded; as 4 constantes de `font-data.ts` são transcrição byte-a-byte de `FontData.rb`. `averageWidth()` devolve sempre 0 porque o Ruby nunca recomputa `@averageWidth` no modo de dados (Category C). **Divergência**: (a) Category B — `FontMetrics#width` no Ruby referencia `@font[font].averageWidth` (`@font` singular, typo; `nil` → crash em glifo fora de 32–126); implementamos a intenção (`data.averageWidth()`), com fallback alcançável mas nunca disparado no set ASCII; (b) `height`/`width` usam `Math.trunc` = `.to_i` de positivo; (c) `glyphWidth` devolve `number\|null` (não `undefined`) para casar com `nil` do Ruby. `toRuby()` é gerador de código (formato 6 espaços, 4 entradas por linha, `'%.3f'`) — pinado em teste, não usado em runtime. |
| 17.12 — Substituir `SimpleXMLElement` → `XMLElement` | ✅ 2026-11-04 | Substituição em massa do minimizador da Fase 12 pelo `XMLElement` real (byte-fiel a `XMLElement.rb`). **Movimentos**: (1) interface `XMLElementLike` movida p/ `src/xml/xml-element-like.ts`; `XMLElement` importa de lá. (2) `SimpleXMLElement`+`createText`/`createComment`/`createBlob`+`RawHTMLNode` removidos; `src/richtext/xml-like.ts` **apagado**; antigo `tests/richtext/xml-like_test.ts` substituído por `tests/xml/fragment_test.ts` (contrato XMLElementLike + `Fragment` + `XMLComment`/`XMLBlob`). (3) reescrita de imports em ~70 arquivos (src+tests) via Python: `xml-like.ts` → `xml/xml-element.ts`/`xml/xml-element-like.ts`, `SimpleXMLElement`→`XMLElement`, `createComment`→`new XMLComment`, `createBlob`→`new XMLBlob`; `createText` descartado (identity). (4) `Fragment extends XMLElement` **novo** em `xml-element.ts` — agrupador sem tag (o `XMLElement(null)` real levanta `TypeError` como no Ruby); pontos que usavam fragmento (rtf-report, `:text` do RichText, fallbacks de report-table-cell) migrados p/ `Fragment`/`XMLText`. (5) Bloco 5º não previsto no plano: `src/reports/xml-node.ts` (duplicata mínima de 5 nomes) **apagado**; `msp-xml-re.ts`+`niku-report.ts` migrados p/ as classes reais (`.push`→`.append`, `XMLDocument` de `xml/xml-document.ts`); export removido de `reports/mod.ts`. (6) **Re-aberto** `export * from "./xml/mod.ts"` em `src/mod.ts` (bloqueio do xml-node eliminado). **Divergências de serialização (fiel a Ruby, verificadas no oracle)**: texto via `append` vira nó `XMLText` (children não são mais strings); `to_s` insere `\n`+1 espaço **entre** filhos-elementos quando `>1` filho não-`XMLText`; tags void só auto-fecham com `selfClosing=true` (`<hr/>`/`<br/>`/`<meta/>`/`<img/>` quando passado, senão `<hr></hr>`); `hr`/`br`/`meta` no RichText/HTMLDocument recebem a flag, mas `img`/`hr`/`link` de Navigator/Report/ReportTableCell **não** → `<img></img>` (como o Ruby); attrs ordenados; `escape` emite `\"` sob `compat.keepRubyBugs`. **Re-baselines de teste** decorrentes: Gantt header/line/legend + Picture (children agora `XMLText`, lidos via `to_s()`); `markdown-snapshots.json` regenerado (indentação real do serializer); `reports-extensions.golden.json` regenerado via `deno task golden:generate:extensions` (diff = só whitespace/`<img>`); expectation inline de `reports-extensions_golden_test.ts:75` ajustada p/ `<div>\n <b>…`. **Gates**: `deno fmt`/`deno check src/mod.ts`/`deno check tests/`/`deno lint src tests` todos limpos; `deno test tests/richtext tests/xml` 37/384; suíte completa **637 passed (5881 steps) / 0 failed / 0 ignored (1 step)**, EXIT=0. `grep SimpleXMLElement` → só 5 comentários históricos, zero código. |
| 17.13 — Substituir `HTMLDocument` mínimo | ✅ 2026-11-04 | Substituição da casca mínima `richtext/html-shell.ts` (`createHtmlShell`/`HtmlShell`) pelo `HTMLDocument` real de `html/html-document.ts` (porta fiel de `HTMLDocument.rb`, criado na 17.4). **Movimentos**: (1) `src/richtext/html-shell.ts` **apagado**; exports `HtmlShell`/`createHtmlShell` removidos de `richtext/mod.ts`; comentário de `html/mod.ts` atualizado. (2) Consumidores migrados p/ o padrão Ruby (`Snip.rb:77`/`Document.rb:129`/`Report.rb:181`): `const doc = new HTMLDocument(); const head = doc.generateHead(title)` — `head` **é** `doc.html` (o retorno do Ruby `@html << HEAD.new{…}`), então `head << stylesheet/link` insere o stylesheet como **irmão** do `<head>`, não filho; `body = new XMLElement('body'); doc.html.append(body)`; serialização por `doc.write('.')` (estilo `puts`, com `\n` após cada elemento de topo), não concatenação pura como a casca fazia. (3) **Re-aberto** `export * from "./html/mod.ts"` em `src/mod.ts` (Bloco B). **Divergências assumidas (Category C, fiéis ao Ruby)**: comentário de topo agora é `This file has been generated by syntaxmesh v0.0.0` (era `Rich text document (SyntaxMesh)`); `<html>` ganha `xml:lang="en"` + `lang="en"` (ordenados alfabeticamente pela saída do 17.1); `<link>` vira irmão de `<head>` (como `Report.rb:205`); `write('.')` produz `\n` após `<!DOCTYPE html>` e após cada elemento de topo. Probe com `RichTextSnip` + TOC confirmou a estrutura byte-a-byte compatível com `HTMLDocument.rb`/`Report.rb`. **Re-baselines**: nenhum — as suítes de `tests/richtext`/`tests/html`/`tests/model/report-generate` usam `includes`/`startsWith` no `<!DOCTYPE html>`/`<title>`/marcadores, todos ainda válidos. **Gates**: `deno fmt`/`deno check src/mod.ts`/`deno check tests/`/`deno lint src tests` todos limpos; `deno test tests/richtext tests/html tests/model/report-generate_test.ts` 29/321; suíte completa **637 passed (5881 steps) / 0 failed / 0 ignored (1 step)**, EXIT=0. |
| 17.14 — Substituir `ICalendar` mínimo | ✅ 2026-11-04 | Substituição do mínimo `reports/i-calendar.ts` (Fase 14.19.1) pelo `ICalendar` real de `src/ical/` (porta fiel de `ICalendar.rb`, criada nas 17.5/17.6). **Movimentos**: (1) `src/reports/i-calendar.ts` **apagado**; `tests/reports/i-calendar_test.ts` apagado (cobertura substituída por `tests/ical/{component,i-calendar,todo-event-journal}_test.ts`, como o xml-like_test em 17.12). (2) `i-cal-report.ts` importa agora de `../ical/mod.ts` — API pública idêntica no subconjunto usado (`new ICalendar(uid)`, `new Todo/Event/Journal(...)`, `percentComplete`, `priority`, `relatedTo`, `description`, `setOrganizer`, `addAttendee`, `to_s`); nenhum call-site precisou de mudança de forma. (3) `reports/mod.ts` re-exporta os nomes do ical desde `../ical/mod.ts` mantendo o alias `Journal as ICalJournal` (o `Journal` do topo é o modelo ADR 029); o bloco chega ao `src/mod.ts` via `reports/mod.ts` — **sem** `export * from "./ical/mod.ts"` direto para não criar ambiguidade `export *` nos 6 nomes duplicados nem colisão de `Journal`. Comentário de `ical/mod.ts` atualizado. **Divergências mínimo→real (já pinnadas nos testes da 17.5/17.6; irrelevantes p/ o report)**: `Component` real é abstrato e deriva `type` do nome da classe (o mínimo recebia `type` explícito); `to_s` usa callback (yield do Ruby) em vez de string; `description`/`relatedTo` vazio-publicável (`!== null`, truthy do Ruby); `attendees` protected. Probe: nenhum golden de relatório contém iCal (grep `VTODO`/`svg` nos `.json` = 0), então não há re-baseline. **Gates**: `deno fmt`/`deno check src/mod.ts`/`deno check` dos testes ical+report/`deno lint src tests` limpos; `deno test tests/ical tests/reports` **102 passed (694 steps) / 0 failed**; suíte completa **636 passed (5851 steps) / 0 failed / 0 ignored (1 step)**, EXIT=0 (Δ −1 describe / −30 steps = arquivo mínimo removido). |
| 17.15 — Substituir `Painter` mínimo | ✅ 2026-11-04 | Substituição do mínimo `src/painter-min.ts` (`PainterMin`/`PainterScope`/`colorFromHsv`/`PaintPoint`, Fase 14.19.x) pelo Painter real de `src/painter/` (17.7–17.10). **Movimentos**: (1) `src/painter-min.ts` **apagado**; `tests/painter-min_test.ts` apagado (cobertura substituída por `tests/painter/*_test.ts`, 42 passed/155 steps desde a 17.11). (2) `chart-plotter.ts` re-escrito p/ a API real: `new Painter(w, h)`, `painter.color(hue, sat, 230, "hsv")` (oráculo Ruby pinou: o **4º argumento é ignorado**, o modo HSV vem da aridade 4 — `ChartPlotter.rb:96`), scopes viram `Group`, `PaintPoint[]`→`Point[]`, cores como `Color` (SVGValue aceita `{ to_s() }`), `stroke_width` em `Text` legal (∈ StrokeAttrs ⊂ TextAttrs). (3) `src/mod.ts`: `export * from "./painter-min.ts"` removido (Bloco D `painter/mod.ts` ativo desde 17.7); cabeçalho de `painter/mod.ts` atualizado. **Divergência de forma de saída (esperada e fiel)**: o serializer real insere `\n`+indent entre >1 filho não-texto, o mínimo serializava flat — probe Ruby (`.tmp/chartplotter_ruby_probe.rb`, `FIRST80="<svg height=\"480px\" width=\"640px\">\n <g font-size=\"11pt\" stroke=\"#000000\">…"`) vs port pós-substituição: mesma estrutura/indentação; diferenças de precisão de coordenadas/labels são comportamento pré-existente do `ChartPlotter` port, não do serializer. Diff old-min-vs-real feito com cópias `git show HEAD:` temporárias (apagadas depois). **Gates**: `deno fmt`/`deno check src/mod.ts`/`deno check tests/chart-plotter_test.ts`/`deno lint src tests` limpos; `deno test tests/chart-plotter_test.ts tests/reports/trace-report_test.ts tests/painter` **46 passed (183 steps) / 0 failed**; suíte completa **635 passed (5839 steps) / 0 failed / 0 ignored (1 step)**, EXIT=0 (Δ −1 describe / −12 steps = `painter-min_test.ts` removido). Nenhum golden contém SVG (grep já feito na 17.14 = 0), então não há re-baseline. |
| 17.16 — Golden tests (HTML/XML/iCal) | ✅ 2026-11-04 | **36 casos** (25 `html-xml` + 11 `ical`), ≥ 30 exigidos. **Oráculos**: `scripts/golden/html-xml.rb` — `XMLElement`/`XMLText`/`XMLNamedText`/`XMLComment`/`XMLBlob`/`XMLDocument`/`HTMLDocument` (attrs ordenados, escapes `&`→`&amp;`/`"`→`\"`, texto `<>&`, self-closing vs void sem flag, 1 filho sem `\n` vs 2+ com `\n`+indent, canonicalização `--`→`-\-`, re-indent de blob, `write('.')` puts-style, docTypes html5/strict com `generateHead`+metaTags+blob); `scripts/golden/ical.rb` — envelope, Todo default (DUE/-1) vs 100% (COMPLETED), Event (PRIORITY:1/DTEND/TRANSP), Journal, escapes RFC de DESCRIPTION + RELATED-TO + ORGANIZER/2×ATTENDEE, description vazia (truthy do Ruby), dobra ASCII e UTF-8 multibyte (Categoria C: reset da contagem sem somar o espaço), ordem todos→events→journals. **Determinismo**: `AppConfig` do oracle igualado aos defaults do port (`syntaxmesh`/`SyntaxMesh`/`0.0.0`/`@vanaware/syntaxmesh`) — comentário "generated by…", PRODID e UID casam byte-a-byte sem normalização; ical: fuso fixo `Europe/Berlin` gravado em `spec.tz` (padrão reports golden; o teste aplica `TjTime.setTimeZone` com try/finally), `creationDate`/`lastModified` pinados, e **DTSTAMP congelado no oracle** (`ICAL_FROZEN_NOW` monkey-patch de `TjTime#initialize`, precedente `FROZEN_NOW` do gantt) — golden byte-idempotente (regra 5 do README, verificado: dois runs `diff` = idêntico); o teste normaliza `DTSTAMP:\d{8}T\d{6}Z`→`@@NOW@@` nos dois lados (o port não tem seam de relógio). CRLF do `foldLines` **não** é normalizado — é a carga útil (RFC 5545); html-xml é byte-a-byte sem nenhuma normalização (strings internas). **Achados**: (a) `Event` não tem `attr_accessor :priority` no Ruby (fixo 1) e o `priority` do `Todo` nem é serializado — caso `event_priority` removido do golden (nada alcançável p/ comparar); (b) `write('.')` contamina o stdout do oráculo se não for capturado (`capture_stdout`); (c) `AppConfig` é classe **top-level** no Ruby (não `TaskJuggler::AppConfig`) e suas class vars só existem após setar; (d) 17.16.7 não exige mexer em `deno.jsonc` — a task `golden:generate:ruby` itera a lista interna de `generate_golden.ts`, onde os dois scripts foram adicionados. **README** (`scripts/golden/README.md`): tabela + seção "HTML/XML e iCalendar Golden Tests (Fase 17.16)". **Gates**: `deno fmt`/`deno check`/`deno lint packages/core/tests` limpos; `deno test tests/golden/html-xml_golden_test.ts tests/golden/ical_golden_test.ts` **2 passed (40 steps) / 0 failed**; suíte completa **637 passed (5879 steps) / 0 failed / 0 ignored (1 step)**, EXIT=0 (Δ +2 describes / +40 steps = os dois arquivos novos; reorder espontâneo de `chargebookings` em `attribute-definitions.golden.json` na regeração não quebrou teste algum; `.html` de brinde revertidos via `git checkout` pela regra do README). |
| 17.17 — Verificação final | ✅ 2026-11-04 | Fechamento da fase, 10/10. **(17.17.1)** a task raiz chama-se `tests` (não existe `check-all` no `deno.jsonc` — AGENTS §12 desactualizado); rodou-se a equivalência: `deno task check:all` (todos os members + `scripts/**/*.ts`) **EXIT=0**, `deno task fmt:check` 686 arquivos **EXIT=0**, `deno task lint` 642 arquivos **EXIT=0**. **(17.17.2)** `deno task golden:generate` **EXIT=0** e idempotente para os dois goldens novos (`html-xml`/`ical` sem diff após regeração consecutiva — DTSTAMP congelado); `tests/golden` **30 passed (1092 steps) / 0 failed**; suíte completa **638 passed (5883 steps) / 0 failed / 0 ignored (1 step) EXIT=0** (Δ +1 describe/+4 steps = smoke novo). Re-baseline legítimo de `reports-extensions.golden.json` (TS-side, gerador de extensões): a saída passou do `SimpleXMLElement` flat/self-closing p/ o serializer real do `XMLElement` (`\n`+indent, `<img…></img>` void) — consequência esperada da 17.12, testes verdes com o novo baseline (uma expectativa ajustada no próprio `reports-extensions_golden_test.ts`: `<div>\n <b>…` com o indent real). Revertido o reorder cosmético de `chargebookings` em `attribute-definitions.golden.json` (não-determinismo pré-existente do oráculo Ruby; o teste ordena por id dos dois lados, independente da Fase 17). **(17.17.3/4)** greps: **zero referências de código** a `SimpleXMLElement`/`PainterMin` em `packages/`; sobram só 6+1 menções **históricas em comentários** (xml-element.ts, fragment_test, 2 gantt tests, chart-plotter.ts, cabeçalhos de mod.ts) documentando a substituição — aceito como registro de fidelidade. **(17.17.5)** ADR 038 (`038-substituicao-xml.md`, Aceito 2026-11-04) indexada no `decisoes/README.md:98`; commit pendiente junto al resto da fase. **(17.17.6)** probe `deno check`: os 16 nomes exportados do entry do pacote (`XMLElement`…`FontMetrics`) importáveis desde `@vanaware/syntaxmesh` sem colisão (`Journal` do topo = modelo ADR 029; componente iCal via alias `ICalJournal`). **(17.17.7/10)** criado `tests/integration/smoke_after_phase_17_test.ts` — 4 steps: HTMLDocument('html5') com `<!DOCTYPE html>` + attrs ordenados (`lang` antes de `xml:lang`) + comentário generated-by; ICalendar real → `BEGIN:VJOURNAL`/`SUMMARY`/CRLF RFC 5545 (o `\n`→`\r\n` do `foldLines` é carga útil, descoberta do smoke); modelo Journal (Fase 16) intacto; `RichTextElement.to_html()` → `instanceof XMLElement` real (contrato `XMLElementLike` mantido). **(17.17.8)** auditoria plano×tarefas: subfases 17.0–17.16 do plano têm todas seção de tarefas + registro; 17.17 é a seção de verificação. **(17.17.9)** `fase-17-html-xml.md` sem `### 21.X` nem `ADR 028` (grep 0; numeração já corrigida junto da ADR 038). **Docs de fechamento sincronizados:** status ✅ no `-tarefas.md`/`plano.md`/`CURRENT.md`/`AGENTS.md`. Após a regeração, os 10 `.html` de brinde (tracked, modificados pelo oráculo Ruby) foram revertidos via `git checkout` — regra do README; verificação final: `fmt:check` 686 arquivos EXIT=0, `lint` 642 EXIT=0, `tests/golden + tests/integration` **61 passed (1215 steps) / 0 failed**. |

---

## Progresso

```
[x] 17.0  ADR 038 (substituição XML/HTML/ICalendar/Painter)  —   5/5
[x] 17.1  XMLElement + XMLText + XMLNamedText + XMLComment + XMLBlob — 21/22
[x] 17.2  XMLDocument                                       —   7/8
[x] 17.3  HTMLElements                                      —   6/6
[x] 17.4  HTMLDocument                                      —  18/18
[x] 17.5  ICalendar estrutura + Component + Person          —  26/26
[x] 17.6  Todo, Event, Journal                              —  15/15
[x] 17.7  Color + Points + SVGSupport                       —  19/19
[x] 17.8  Element + Group                                   —  10/10
[x] 17.9  Primitives + BasicShapes + Text                   —  16/16
[x] 17.10 Painter                                           —   8/8
[x] 17.11 FontMetrics + FontMetricsData + FontData          —  29/29
[x] 17.12 Substituir SimpleXMLElement → XMLElement          —   8/8
[x] 17.13 Substituir HTMLDocument mínimo                    —   4/4
[x] 17.14 Substituir ICalendar mínimo                       —   4/4
[x] 17.15 Substituir Painter mínimo                         —   4/4
[x] 17.16 Golden tests (HTML/XML/ICalendar)                 —   10/10
[x] 17.17 Verificação final                                 —  10/10
══════════════════════════════════════════════════════════
FASE 17 CONCLUÍDA: 2026-11-04 — suíte 638 passed (5883 steps) / 0 failed, EXIT=0
──────────────────────────────────────────────────────────────
TOTAL: ~180
```

---

## Bloco A — Fundação

### 17.0 — ADR 038 (substituição XML/HTML/ICalendar/Painter)

**Objetivo:** formalizar a substituição das implementações mínimas das Fases 12/14/15.

**⚠️ Nota:** o plano pedia `ADR 028` e este arquivo pedia `ADR 029`, mas 028 é
Gantt (Fase 15) e 029 é Journal/AlertLevel (Fase 16, já entregue). Pela regra do
`decisoes/README.md` (nunca renumerar; usar o próximo livre — 033–037 estão
reservados), aqui usamos **ADR 038**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.0.1 | Criar `docs/syntaxmesh/decisoes/038-substituicao-xml.md` com frontmatter | idem | arquivo existe |
| 17.0.2 | Seção **Contexto:** `XMLElementLike` introduzida na Fase 12 por compatibilidade; `HTMLDocument`, `ICalendar`, `Painter` mínimos nas Fases 14/15 | idem | — |
| 17.0.3 | Seção **Decisões:** `XMLElement` real implementa `XMLElementLike`; `SimpleXMLElement` removido; `HTMLDocument`/`ICalendar`/`Painter` substituídos; contratos de saída mantidos | idem | — |
| 17.0.4 | **Alternativas** (manter mínimos — duplicação) + **Consequências** (fidelidade; refatoração de imports) | idem | — |
| 17.0.5 | Atualizar linha `029` em `decisoes/README.md` | idem | 29 linhas |

---

## Bloco A — XML

### 17.1 — `XMLElement` + subclasses

**⚠️ RUBY: `XMLElement.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §2 `.freeze` → `Object.freeze`, §5 escape de strings**

**Pré-requisitos:** nenhum (substitui `SimpleXMLElement` da Fase 12).

#### 17.1.1 — `XMLElement`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.1.1 | Criar `packages/core/src/xml/xml-element.ts` com `class XMLElement implements XMLElementLike` | idem | `deno check` |
| 17.1.1.2 | Campos: `name: string \| null`, `attrs: Record<string, string>`, `selfClosing: boolean`, `children: XMLElement[]` | idem | `deno check` |
| 17.1.1.3 | ⚠️ Constructor `(name, attrs = {}, selfClosing = false, block?)` — valida `name` (string ou null) | idem | 4 testes |
| 17.1.1.4 | Constructor valida `attrs`: nomes e valores não-nulos | idem | 3 testes |
| 17.1.1.5 | ⚠️ Constructor processa `block`: chama `yield(block)` ou usa `block` | idem | 4 testes |
| 17.1.1.6 | Constructor converte children string em `XMLText` | idem | 2 testes |
| 17.1.1.7 | Constructor filtra null | idem | 2 testes |
| 17.1.1.8 | Constructor valida tipo de cada child | idem | 3 testes |
| 17.1.1.9 | ⚠️ `append(child: XMLElement \| XMLElement[] \| string \| null): this` — string → `XMLText` | idem | 4 testes |
| 17.1.1.10 | `append` com array | idem | 2 testes |
| 17.1.1.11 | `append` com null → ignorado | idem | 1 teste |
| 17.1.1.12 | `append` com XMLElement → push | idem | 2 testes |
| 17.1.1.13 | ⚠️ `setAttr(attribute, value): void` — valida string | idem | 3 testes |
| 17.1.1.14 | ⚠️ `getAttr(attribute): string \| undefined` | idem | 2 testes |
| 17.1.1.15 | ⚠️ `toHTML(): string` — alias de `to_s(0)` | idem | 2 testes |
| 17.1.1.16 | ⚠️ `to_s(indent = 0): string` — `<name` + attrs ordenados + `>` | idem | 4 testes |
| 17.1.1.17 | `to_s` com `selfClosing` e vazio → `/>` | idem | 2 testes |
| 17.1.1.18 | `to_s` com children → `\n` + indentação | idem | 3 testes |
| 17.1.1.19 | ⚠️ `protected escape(str, quotes = false): string` — `&`, `"`, `<`, `>` | idem | 5 testes |
| 17.1.1.20 | ⚠️ `protected indentation(indent): string` | idem | 2 testes |

#### 17.1.2 — `XMLText`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.2.1 | ⚠️ `class XMLText extends XMLElement` com Constructor `(text)` | idem | 2 testes |
| 17.1.2.2 | ⚠️ `to_s(indent): string` — escapa `<`, `>`, `&` (mas não `"`) | idem | 4 testes |

#### 17.1.3 — `XMLNamedText`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.3.1 | ⚠️ `class XMLNamedText extends XMLElement` com Constructor `(text, name, attrs = {})` | idem | 3 testes |
| 17.1.3.2 | Chama `super(name, attrs)` + `append(new XMLText(text))` | idem | 2 testes |

#### 17.1.4 — `XMLComment`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.4.1 | ⚠️ `class XMLComment extends XMLElement` com Constructor `(text = '')` | idem | 2 testes |
| 17.1.4.2 | ⚠️ `to_s(indent): string` — `"<!-- " + canonicalize_comment(text) + " -->\n" + ' '.repeat(indent)` | idem | 3 testes |
| 17.1.4.3 | ⚠️ Canonicaliza `--` → `-\-` | idem | 3 testes |
| 17.1.4.4 | Teste agregado: comentário com `--` | idem | 1 teste |

#### 17.1.5 — `XMLBlob`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.5.1 | ⚠️ `class XMLBlob extends XMLElement` com Constructor `(blob = '')` | idem | 2 testes |
| 17.1.5.2 | ⚠️ `to_s(indent): string` — itera caracteres, `\n` → `\n` + `' '.repeat(indent)` | idem | 4 testes |
| 17.1.5.3 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.2 — `XMLDocument`

**⚠️ RUBY: `XMLDocument.rb` (arquivo inteiro — ~70 linhas)**

**Pré-requisitos:** 17.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.2.1 | Criar `packages/core/src/xml/xml-document.ts` com `class XMLDocument` | idem | `deno check` |
| 17.2.2 | Campo `protected elements: XMLElement[]` | idem | `deno check` |
| 17.2.3 | ⚠️ Constructor `(block?)` — processa `block` (opcional) | idem | 3 testes |
| 17.2.4 | ⚠️ `append(arg): void` — array (append flat), null (ignorado), XMLElement (push) | idem | 5 testes |
| 17.2.5 | `append` com tipo inválido → `throw Error` | idem | 2 testes |
| 17.2.6 | ⚠️ `to_s(): string` — concatena `element.to_s(0)` | idem | 2 testes |
| 17.2.7 | ⚠️ `write(filename: string): string \| void` — `'.'` → string (browser); senão, escreve | idem | 3 testes |
| 17.2.8 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco B — HTML

### 17.3 — `HTMLElements`

**⚠️ RUBY: `HTMLElements.rb` (~80 linhas)**
**🔎 CHEAT: §3 `class_eval` → map estático de classes**

**Pré-requisitos:** 17.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.3.1 | Criar `packages/core/src/html/html-elements.ts` | idem | `deno check` |
| 17.3.2 | ⚠️ Lista de tags: `a, b, body, br, code, col, colgroup, div, em, frame, frameset, footer, h1, h2, h3, head, html, hr, meta, p, pre, span, table, td, title, tr` | idem | 1 teste (contagem ≥ 25) |
| 17.3.3 | ⚠️ Tags self-closing: `area, base, basefont, br, hr, input, img, link, meta` | idem | 1 teste |
| 17.3.4 | ⚠️ `function createHTMLElementClass(tag: string): typeof XMLElement` — retorna classe que chama `super(tag, attrs, selfClosing)` | idem | 3 testes |
| 17.3.5 | Exporta cada classe: `HTML`, `HEAD`, `BODY`, `DIV`, `H1`, `A`, `TABLE`, etc. | idem | 5 testes |
| 17.3.6 | Teste: `new DIV({ class: 'foo' })` funciona | idem | 1 teste |

---

### 17.4 — `HTMLDocument`

**⚠️ RUBY: `HTMLDocument.rb` (~120 linhas)**

**Pré-requisitos:** 17.2, 17.3.

#### 17.4.1 — Constructor + doctypes

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.4.1.1 | Criar `packages/core/src/html/html-document.ts` com `class HTMLDocument extends XMLDocument` | idem | `deno check` |
| 17.4.1.2 | Campo `html: XMLElement` | idem | `deno check` |
| 17.4.1.3 | ⚠️ Constructor `(docType: 'html5' \| 'strict' \| 'transitional' \| 'frameset' = 'html5')` | idem | 3 testes |
| 17.4.1.4 | ⚠️ Se `html5`: `<!DOCTYPE html>` | idem | 2 testes |
| 17.4.1.5 | ⚠️ Senão: `<?xml version="1.0" encoding="UTF-8"?>` + `<!DOCTYPE html PUBLIC ...>` | idem | 4 testes |
| 17.4.1.6 | Comentário `<!-- This file has been generated by ... -->` | idem | 2 testes |
| 17.4.1.7 | `<html xml:lang="en" lang="en">` | idem | 2 testes |
| 17.4.1.8 | Se não `html5`: `xmlns="http://www.w3.org/1999/xhtml"` | idem | 2 testes |

#### 17.4.2 — `generateHead`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.4.2.1 | ⚠️ `generateHead(title, metaTags = {}, blob?): XMLElement` — `<head>` | idem | 2 testes |
| 17.4.2.2 | ⚠️ `<title>title</title>` | idem | 2 testes |
| 17.4.2.3 | ⚠️ `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">` | idem | 2 testes |
| 17.4.2.4 | ⚠️ `<meta http-equiv="X-UA-Compatible" content="IE=9">` | idem | 2 testes |
| 17.4.2.5 | ⚠️ Para cada `metaTags`: `<meta name="..." content="...">` | idem | 3 testes |
| 17.4.2.6 | Se `blob`: `XMLBlob` | idem | 2 testes |
| 17.4.2.7 | Append em `html` | idem | 1 teste |
| 17.4.2.8 | Teste: `doc.to_s()` contém `<!DOCTYPE html>` | idem | 1 teste |
| 17.4.2.9 | Teste: `doc.to_s()` contém `<title>My Title</title>` | idem | 1 teste |
| 17.4.2.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — ICalendar

### 17.5 — `ICalendar` estrutura + `Component` + `Person`

**⚠️ RUBY: `ICalendar.rb` (arquivo inteiro — ~330 linhas)**
**🔎 CHEAT: §5 strings, §12 Categoria B (foldLines)**

**Pré-requisitos:** Fase 2 (`TjTime`).

#### 17.5.1 — `Person`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.1.1 | Criar `packages/core/src/ical/person.ts` com `class Person` | idem | `deno check` |
| 17.5.1.2 | Campos `readonly name: string`, `readonly email: string` | idem | `deno check` |
| 17.5.1.3 | Constructor `(name, email)` | idem | 2 testes |

#### 17.5.2 — `Component` (abstract)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.2.1 | Criar `packages/core/src/ical/component.ts` com `class Component` | idem | `deno check` |
| 17.5.2.2 | Campos: `protected ical`, `protected type: string`, `readonly uid: string`, `protected summary: string`, `protected startDate: TjTime` | idem | `deno check` |
| 17.5.2.3 | Campos: `description: string \| null`, `relatedTo: string \| null`, `organizer: Person \| null`, `protected attendees: Person[]` | idem | `deno check` |
| 17.5.2.4 | ⚠️ Constructor `(ical, uid, summary, startDate)` — `type = className.toUpperCase()`; `uid = uid + '-' + type` | idem | 3 testes |
| 17.5.2.5 | ⚠️ `setOrganizer(name, email): void` | idem | 2 testes |
| 17.5.2.6 | ⚠️ `addAttendee(name, email): void` | idem | 2 testes |
| 17.5.2.7 | ⚠️ `to_s(): string` — `BEGIN:V<type>`; `DTSTAMP`, `CREATED`, `UID`, `LAST-MODIFIED`, `SUMMARY`, `DTSTART` | idem | 6 testes |
| 17.5.2.8 | `to_s` opcional: `DESCRIPTION`, `RELATED-TO` | idem | 3 testes |
| 17.5.2.9 | `to_s` com organizer + attendees | idem | 3 testes |
| 17.5.2.10 | `to_s` chama `yield` para subclasses | idem | 1 teste |
| 17.5.2.11 | `END:V<type>` | idem | 1 teste |
| 17.5.2.12 | ⚠️ `private dateTime(date)` — delega para `ical` | idem | 2 testes |
| 17.5.2.13 | ⚠️ `private quoted(str)` — escapa `;`, `,`, `"`, `\\`, `\n` | idem | 5 testes |

#### 17.5.3 — `ICalendar` container

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.3.1 | Criar `packages/core/src/ical/i-calendar.ts` com `class ICalendar` | idem | `deno check` |
| 17.5.3.2 | Constante `static readonly LINELENGTH = 75` | idem | `deno check` |
| 17.5.3.3 | Campos: `readonly uid`, `creationDate: TjTime`, `lastModified: TjTime` | idem | `deno check` |
| 17.5.3.4 | Campos: `private todos: Todo[]`, `private events: Event[]`, `private journals: Journal[]` | idem | `deno check` |
| 17.5.3.5 | ⚠️ Constructor `(uid)` — `uid = "<packageName>-<uid>"`; `creationDate = lastModified = TjTime.now().utc()` | idem | 3 testes |
| 17.5.3.6 | ⚠️ `addTodo(todo)`, `addEvent(event)`, `addJournal(journal)` | idem | 3 testes |

#### 17.5.4 — Serialização + `foldLines`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.4.1 | ⚠️ `to_s(): string` — `BEGIN:VCALENDAR`, `PRODID`, `VERSION:2.0`, todos + events + journals, `END:VCALENDAR` | idem | 4 testes |
| 17.5.4.2 | ⚠️ `dateTime(date): string` — `date.to_s('%Y%m%dT%H%M%SZ', 'UTC')` | idem | 3 testes |
| 17.5.4.3 | ⚠️ `private foldLines(str): string` — linhas > `LINELENGTH` octetos → quebra com `\n ` | idem | 4 testes |
| 17.5.4.4 | Converte `\n` → `\r\n` | idem | 3 testes |
| 17.5.4.5 | Teste: `to_s` com 1 todo | idem | 1 teste |
| 17.5.4.6 | Teste: `foldLines` longo | idem | 1 teste |
| 17.5.4.7 | Teste: CRLF | idem | 1 teste |
| 17.5.4.8 | Teste: `foldLines` com UTF-8 (emoji) | idem | 1 teste |
| 17.5.4.9 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.6 — `Todo`, `Event`, `Journal`

**⚠️ RUBY: `ICalendar.rb` — classes `Todo`, `Event`, `Journal`**

**Pré-requisitos:** 17.5.

#### 17.6.1 — `Todo`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.1.1 | Criar `packages/core/src/ical/todo.ts` com `class Todo extends Component` | idem | `deno check` |
| 17.6.1.2 | Campos: `protected endDate: TjTime`, `priority: number`, `percentComplete: number` | idem | `deno check` |
| 17.6.1.3 | ⚠️ Constructor `(ical, uid, summary, startDate, endDate)` — `priority = 0`, `percentComplete = -1` | idem | 3 testes |
| 17.6.1.4 | ⚠️ `to_s()` — se `percentComplete < 100`: `DUE:...`; senão: `COMPLETED:...` | idem | 4 testes |
| 17.6.1.5 | `PERCENT-COMPLETE:...` | idem | 2 testes |
| 17.6.1.6 | Teste: `to_s` com `percentComplete 50` | idem | 1 teste |
| 17.6.1.7 | Teste: `to_s` com `percentComplete 100` | idem | 1 teste |

#### 17.6.2 — `Event`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.2.1 | Criar `packages/core/src/ical/event.ts` com `class Event extends Component` | idem | `deno check` |
| 17.6.2.2 | Campos: `protected endDate: TjTime`, `priority: number` (default 1) | idem | `deno check` |
| 17.6.2.3 | ⚠️ Constructor `(ical, uid, summary, startDate, endDate)` | idem | 3 testes |
| 17.6.2.4 | ⚠️ `to_s()` — `PRIORITY:...`, `DTEND:...`, `TRANSP:TRANSPARENT` | idem | 4 testes |
| 17.6.2.5 | Teste: `priority default 1` | idem | 1 teste |

#### 17.6.3 — `Journal`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.3.1 | Criar `packages/core/src/ical/journal.ts` com `class Journal extends Component` | idem | `deno check` |
| 17.6.3.2 | ⚠️ Constructor `(ical, uid, summary, startDate)` | idem | 2 testes |
| 17.6.3.3 | Teste: `to_s` | idem | 1 teste |
| 17.6.3.4 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco D — Painter

### 17.7 — `Color` + `Points` + `SVGSupport`

**⚠️ RUBY: `Painter/Color.rb` (~250 linhas), `Painter/Points.rb` (~50 linhas), `Painter/SVGSupport.rb` (~30 linhas)**
**🔎 CHEAT: §6 `Float#round`, §12 Categoria B (hsvToRgb)**

**Pré-requisitos:** 17.1 (`XMLElement`).

#### 17.7.1 — `Color`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.1.1 | Criar `packages/core/src/painter/color.ts` com `class Color` | idem | `deno check` |
| 17.7.1.2 | ⚠️ `static NamedColors: Record<string, [number, number, number]>` — 155 cores | idem | 1 teste (contagem ≥ 140) |
| 17.7.1.3 | ⚠️ Constructor `(...args)` — 1 arg (nome), 3 args (RGB), 4 args (HSV) | idem | 5 testes |
| 17.7.1.4 | ⚠️ `to_rgb(): [number, number, number]` | idem | 3 testes |
| 17.7.1.5 | ⚠️ `to_hsv(): [number, number, number]` | idem | 3 testes |
| 17.7.1.6 | ⚠️ `to_s(): string` = `#RRGGBB` | idem | 4 testes |
| 17.7.1.7 | ⚠️ `private hsvToRgb(h, s, v)` — `hi = (h/60).floor % 6` | idem | 6 testes |
| 17.7.1.8 | ⚠️ `private rgbToHsv(r, g, b)` | idem | 4 testes |
| 17.7.1.9 | Teste: `new Color('red').to_s() === '#ff0000'` | idem | 1 teste |
| 17.7.1.10 | Teste: `new Color(255, 128, 0).to_s() === '#ff8000'` | idem | 1 teste |

#### 17.7.2 — `Points`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.2.1 | Criar `packages/core/src/painter/points.ts` com `class Points` | idem | `deno check` |
| 17.7.2.2 | Campo `private points: [number, number][]` | idem | `deno check` |
| 17.7.2.3 | ⚠️ Constructor `(arr)` — valida cada ponto | idem | 3 testes |
| 17.7.2.4 | ⚠️ `to_s(): string` = `"x,y x,y x,y"` | idem | 3 testes |

#### 17.7.3 — `SVGSupport`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.3.1 | Criar `packages/core/src/painter/svg-support.ts` | idem | `deno check` |
| 17.7.3.2 | ⚠️ `valuesToSVG(values): Record<string, string>` — converte `font_size` → `font-size` | idem | 3 testes |
| 17.7.3.3 | Adiciona `pt` para `font_size` | idem | 2 testes |
| 17.7.3.4 | Underscores → dashes | idem | 3 testes |
| 17.7.3.5 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.8 — `Element` + `Group`

**⚠️ RUBY: `Painter/Element.rb` (~80 linhas), `Painter/Group.rb` (~80 linhas)**

**Pré-requisitos:** 17.1, 17.7.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.8.1 | Criar `packages/core/src/painter/element.ts` com `abstract class Element` | idem | `deno check` |
| 17.8.2 | Campos: `protected type: string`, `protected attributes: string[]`, `protected values: Record<string, unknown>`, `protected text: string \| null` | idem | `deno check` |
| 17.8.3 | ⚠️ Constructor `(type, attrs, values)` — valida cada chave em `attrs` | idem | 3 testes |
| 17.8.4 | ⚠️ `to_svg(): XMLElement` — `<type>` + `valuesToSVG` | idem | 3 testes |
| 17.8.5 | Se `text`, append `<text>` | idem | 2 testes |
| 17.8.6 | Criar `class Group` com `private values`, `private elements: Element[]` | idem | `deno check` |
| 17.8.7 | ⚠️ Constructor `(values, block?)` — valida chaves em `[fill, font_family, font_size, stroke, stroke_width]` | idem | 4 testes |
| 17.8.8 | Processa `block` | idem | 2 testes |
| 17.8.9 | ⚠️ `to_svg(): XMLElement` — `<g>` + attrs + children | idem | 3 testes |
| 17.8.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.9 — `Primitives` + `BasicShapes` + `Text`

**⚠️ RUBY: `Painter/Primitives.rb` (~130 linhas), `Painter/BasicShapes.rb` (~130 linhas), `Painter/Text.rb` (~30 linhas)**

**Pré-requisitos:** 17.8.

#### 17.9.1 — `BasicShapes`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.1.1 | Criar `packages/core/src/painter/basic-shapes.ts` | idem | `deno check` |
| 17.9.1.2 | ⚠️ `class Circle extends Element` — `attrs = [cx, cy, r] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.3 | ⚠️ `class Ellipse extends Element` — `attrs = [cx, cy, rx, ry] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.4 | ⚠️ `class Line extends Element` — `attrs = [x1, y1, x2, y2] + StrokeAttrs` | idem | 3 testes |
| 17.9.1.5 | ⚠️ `class Rect extends Element` — `attrs = [x, y, width, height, rx, ry] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.6 | ⚠️ `class PolyLine extends Element` — `attrs = [points] + FillAndStrokeAttrs` | idem | 3 testes |

#### 17.9.2 — `Text`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.2.1 | Criar `packages/core/src/painter/text.ts` com `class Text extends Element` | idem | `deno check` |
| 17.9.2.2 | ⚠️ `attrs = [x, y] + TextAttrs` | idem | 2 testes |
| 17.9.2.3 | ⚠️ Constructor `(str, attrs)` — `text = str` | idem | 2 testes |

#### 17.9.3 — `Primitives` (mix-in)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.3.1 | Criar `packages/core/src/painter/primitives.ts` | idem | `deno check` |
| 17.9.3.2 | ⚠️ `color(...args): Color` | idem | 2 testes |
| 17.9.3.3 | ⚠️ `points(arr): Points` | idem | 2 testes |
| 17.9.3.4 | ⚠️ `group(attrs, block?): Group` | idem | 3 testes |
| 17.9.3.5 | ⚠️ `circle(cx, cy, r, attrs = {}): Circle` | idem | 2 testes |
| 17.9.3.6 | ⚠️ `ellipse(cx, cy, rx, ry, attrs = {}): Ellipse` | idem | 2 testes |
| 17.9.3.7 | ⚠️ `line(x1, y1, x2, y2, attrs = {}): Line` | idem | 2 testes |
| 17.9.3.8 | ⚠️ `polyline(points, attrs = {}): PolyLine` | idem | 2 testes |
| 17.9.3.9 | ⚠️ `rect(x, y, width, height, attrs = {}): Rect` | idem | 2 testes |
| 17.9.3.10 | ⚠️ `text(x, y, str, attrs = {}): Text` | idem | 2 testes |
| 17.9.3.11 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.10 — `Painter`

**⚠️ RUBY: `Painter.rb` (~80 linhas)**

**Pré-requisitos:** 17.8, 17.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.10.1 | Criar `packages/core/src/painter/painter.ts` com `class Painter` | idem | `deno check` |
| 17.10.2 | Campos: `private width: number`, `private height: number`, `private elements: Element[]` | idem | `deno check` |
| 17.10.3 | ⚠️ Constructor `(width, height, block?)` — processa `block` (com ou sem arg) | idem | 4 testes |
| 17.10.4 | ⚠️ `to_svg(): XMLElement` — `<svg width="..." height="...">` + children | idem | 4 testes |
| 17.10.5 | Teste: `to_svg` vazio | idem | 1 teste |
| 17.10.6 | Teste: `to_svg` com 1 rect | idem | 1 teste |
| 17.10.7 | Teste: `block` com arg | idem | 1 teste |
| 17.10.8 | Teste: `block` sem arg (instance_eval) | idem | 1 teste |

---

### 17.11 — `FontMetrics` + `FontMetricsData` + `FontData`

**⚠️ RUBY: `Painter/FontMetrics.rb` (~200 linhas), `Painter/FontMetricsData.rb` (~250 linhas), `Painter/FontData.rb` (~1000 linhas)**
**🔎 CHEAT: §12 Categoria B (kerning)**

**Pré-requisitos:** 17.7.

#### 17.11.1 — `FontMetricsData`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.1.1 | Criar `packages/core/src/painter/font-metrics-data.ts` com `class FontMetricsData` | idem | `deno check` |
| 17.11.1.2 | Campos: `fontName`, `type`, `ptSize`, `height`, `charWidth: Record<string, number>`, `kerningDelta: Record<string, number>` | idem | `deno check` |
| 17.11.1.3 | ⚠️ `glyphWidth(c: string): number \| null` | idem | 3 testes |
| 17.11.1.4 | ⚠️ `averageWidth(): number` | idem | 2 testes |
| 17.11.1.5 | ⚠️ `toRuby(): string` — só para geração | idem | 1 teste |

#### 17.11.2 — `FontData` (constantes)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.2.1 | Criar `packages/core/src/painter/font-data.ts` | idem | `deno check` |
| 17.11.2.2 | ⚠️ `Font_LiberationSans_normal` — copiar byte-a-byte | idem | 1 teste |
| 17.11.2.3 | ⚠️ `Font_LiberationSans_italic` | idem | 1 teste |
| 17.11.2.4 | ⚠️ `Font_LiberationSans_bold` | idem | 1 teste |
| 17.11.2.5 | ⚠️ `Font_LiberationSans_bold_italic` | idem | 1 teste |

#### 17.11.3 — `FontMetrics`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.3.1 | Criar `packages/core/src/painter/font-metrics.ts` com `class FontMetrics` | idem | `deno check` |
| 17.11.3.2 | Campo `private fonts: Record<string, FontMetricsData>` | idem | `deno check` |
| 17.11.3.3 | ⚠️ Constructor: registra `Arial` = `LiberationSans`, `Arial-Italic`, `Arial-Bold`, `Arial-BoldItalic` | idem | 5 testes |
| 17.11.3.4 | ⚠️ `height(font, ptSize): number` — `fontMetrics.height * (ptSize / fontMetrics.ptSize) * (4/3)` | idem | 3 testes |
| 17.11.3.5 | ⚠️ `width(font, ptSize, str): number` — soma `glyphWidth` + kerning | idem | 5 testes |
| 17.11.3.6 | ⚠️ `private checkFontName(font)` | idem | 2 testes |
| 17.11.3.7 | Teste: `height Arial 12` | idem | 1 teste |
| 17.11.3.8 | Teste: `width string simples` | idem | 1 teste |
| 17.11.3.9 | Teste: `width com kerning` | idem | 1 teste |

---

## Bloco E — Substituição

### 17.12 — Substituir `SimpleXMLElement` por `XMLElement`

**⚠️ Contexto:** Fase 12 introduziu `SimpleXMLElement`. Agora removemos.

**Pré-requisitos:** 17.1, Fases 12, 14, 15.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.12.1 | Mover interface `XMLElementLike` para `packages/core/src/xml/xml-element-like.ts` | idem | `deno check` |
| 17.12.2 | `XMLElement` importa de lá | idem | `deno check` |
| 17.12.3 | Atualizar imports em `packages/core/src/richtext/**` | idem | `deno check` |
| 17.12.4 | Atualizar imports em `packages/core/src/**` | idem | `deno check` |
| 17.12.5 | Atualizar imports em `packages/core/src/gantt/**` | idem | `deno check` |
| 17.12.6 | Atualizar imports em `packages/core/tests/**` | idem | `deno check` |
| 17.12.7 | ⚠️ Deletar `SimpleXMLElement` de `packages/core/src/richtext/xml-like.ts` | idem | `grep -r "SimpleXMLElement"` retorna 0 |
| 17.12.8 | Re-rodar todos os testes | idem | verde |

---

### 17.13 — Substituir `HTMLDocument` mínimo

**⚠️ Contexto:** Fase 14 introduziu `HTMLDocument` mínimo. Agora substituímos.

**Pré-requisitos:** 17.4, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.13.1 | Deletar `packages/core/src/html-document.ts` (versão mínima) | idem | `deno check` |
| 17.13.2 | Atualizar imports em `packages/core/src/report.ts` | idem | `deno check` |
| 17.13.3 | Atualizar imports em `packages/core/src/**` | idem | `deno check` |
| 17.13.4 | Re-rodar testes da Fase 14 | idem | verde |

---

### 17.14 — Substituir `ICalendar` mínimo

**⚠️ Contexto:** Fase 14 introduziu `ICalendar` mínimo. Agora substituímos.

**Pré-requisitos:** 17.5, 17.6, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.14.1 | Deletar `packages/core/src/i-calendar.ts` (versão mínima) | idem | `deno check` |
| 17.14.2 | Atualizar imports em `packages/core/src/i-cal-report.ts` | idem | `deno check` |
| 17.14.3 | Atualizar imports em `packages/core/src/**` | idem | `deno check` |
| 17.14.4 | Re-rodar testes da Fase 14 | idem | verde |

---

### 17.15 — Substituir `Painter` mínimo

**⚠️ Contexto:** Fase 14 introduziu `Painter` mínimo (`PainterMin`). Agora substituímos.

**Pré-requisitos:** 17.10, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.15.1 | Deletar `packages/core/src/painter-min.ts` (versão mínima) | idem | `deno check` |
| 17.15.2 | Atualizar imports em `packages/core/src/chart-plotter.ts` | idem | `deno check` |
| 17.15.3 | Atualizar imports em `packages/core/src/**` | idem | `deno check` |
| 17.15.4 | Re-rodar testes da Fase 14 | idem | verde |

---

## Bloco F — Golden tests

### 17.16 — Golden tests (HTML/XML/ICalendar)

**⚠️ RUBY: `HTMLDocument.rb` + `XMLElement.rb` + `ICalendar.rb`**
**Usa:** `tj3` real

**Pré-requisitos:** 17.12–17.15, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.16.1 | Atualizar `scripts/golden/README.md` com seções de `html-xml` e `ical` | idem | existe |
| 17.16.2 | Criar `scripts/golden/html-xml.rb` — constrói `HTMLDocument` com várias tags; serializa | idem | roda |
| 17.16.3 | Testa `XMLElement` + `XMLText` + `XMLComment` + `XMLBlob` | idem | 8 testes |
| 17.16.4 | Serializa em `html-xml.golden.json` | idem | JSON válido |
| 17.16.5 | Criar `scripts/golden/ical.rb` — constrói `ICalendar` com `Todo`, `Event`, `Journal` | idem | roda |
| 17.16.6 | Serializa em `ical.golden.json` | idem | JSON válido |
| 17.16.7 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 17.16.8 | Criar `packages/core/tests/golden/html-xml_golden_test.ts` e `ical_golden_test.ts` | idem | verde |
| 17.16.9 | Comparação byte-a-byte (apenas normalizar line endings) | idem | 4 testes |
| 17.16.10 | Cobertura ≥ 30 casos; commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco G — Verificação final

### 17.17 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 17.17.1 | `deno task check-all` verde | exit 0 |
| 17.17.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 17.17.3 | `grep -r "SimpleXMLElement" packages/` retorna 0 | grep |
| 17.17.4 | `grep -r "PainterMin" packages/` retorna 0 | grep |
| 17.17.5 | ADR 038 criada e commitada | git log |
| 17.17.6 | `XMLElement`, `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`, `XMLDocument`, `HTMLDocument`, `ICalendar`, `Todo`, `Event`, `Journal`, `Person`, `Painter`, `Color`, `Points`, `FontMetrics` exportados em `packages/core/mod.ts` | `deno check` |
| 17.17.7 | `tests/integration/smoke_after_phase_17_test.ts` — cria `HTMLDocument('html5')`, gera string, verifica `<!DOCTYPE html>`; verifica Fase 16 (`Journal`) | 1 teste |
| 17.17.8 | Auditoria: cada subfase do plano `fase-17-html-xml.md` tem tarefas correspondentes | grep |
| 17.17.9 | Corrigir numeração em `fase-17-html-xml.md` (`### 21.X` → `### 17.X`, `ADR 028` → `ADR 038`) | grep |
| 17.17.10 | Teste agregado: `RichTextElement.to_html()` retorna `XMLElement` real (não `SimpleXMLElement`) | 1 teste |

---

## Notas para a IA

1. **Ordem:** 17.0 → 17.1 → 17.2 → 17.3 → 17.4 → 17.5 → 17.6 → 17.7 → 17.8 → 17.9 → 17.10 → 17.11 → 17.12 → 17.13 → 17.14 → 17.15 → 17.16 → 17.17.
2. **`XMLElement` substitui `SimpleXMLElement`.** Interface `XMLElementLike` mantida.
3. **Escape em `XMLText`:** `<`, `>`, `&`. **Não** escapa `"`.
4. **Escape em `XMLElement` attrs:** `&`, `"`.
5. **`XMLComment` canonicaliza `--`** em `-\-`.
6. **`HTMLDocument` 4 doctypes** — html5, strict, transitional, frameset.
7. **`HTMLElements` map estático.** Não usar `class_eval`.
8. **`ICalendar.foldLines`** com `LINELENGTH = 75`.
9. **`dateTime` sempre em UTC.**
10. **`Color.hsvToRgb`** com `hi = (h/60).floor % 6`.
11. **`Painter` gera SVG.** Sem Canvas.
12. **`FontData.rb` copiado byte-a-byte.**
13. **`FontMetrics.width`** aplica kerning.
14. **`SVGSupport.valuesToSVG`** com `font_size` → `font-size` + `pt`.
15. **Substituições em subfases separadas** (17.12–17.15).
16. **Golden tests byte-a-byte** — normalizar apenas line endings.
17. **Sem `any`.** Use `unknown` + narrowing.
18. **Commit por subfase.** `feat(core): xml-element`, etc.
19. **ADR 038** (não 028/029). **028** = Gantt (Fase 15); **029** = Journal (Fase 16).
20. **Não modificar saída de reports** (Fase 14) — apenas imports.
21. **Não modificar `RichTextElement`** (Fase 12) — apenas imports.
22. **Não modificar `GanttChart`** (Fase 15) — apenas imports.
23. **`Painter` mínimo (`PainterMin`) deletado.** Fase 17 substitui.
24. **Copiar `FontData.rb` sem erro.** ~1000 linhas.
25. **`XMLBlob` preserva newlines com indentação.**

---

## Notas específicas por subfase

### 17.0 — ADR 038

- **Substituição de `XMLElementLike` por `XMLElement` real.**
- **`SimpleXMLElement`, `HTMLDocument` mínimo, `ICalendar` mínimo, `Painter` mínimo removidos.**

### 17.1 — XMLElement

- **Classe principal de XML.**
- **`to_s` com indentação.**
- **Subclasses: `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`.**

### 17.2 — XMLDocument

- **Container.**
- **`append`, `to_s`, `write`.**

### 17.3 — HTMLElements

- **Map estático de classes.**
- **~25 tags.**

### 17.4 — HTMLDocument

- **4 doctypes.**
- **`generateHead` com meta tags.**

### 17.5 — ICalendar

- **`Person`, `Component`, `ICalendar`.**
- **`foldLines` com `LINELENGTH = 75`.**

### 17.6 — Todo, Event, Journal

- **Subclasses de `Component`.**
- **`DUE`, `COMPLETED`, `PRIORITY`, `DTEND`.**

### 17.7 — Color, Points, SVGSupport

- **`Color` com 155 cores nomeadas.**
- **`hsvToRgb` e `rgbToHsv`.**
- **`valuesToSVG` com `font_size` → `font-size`.**

### 17.8 — Element, Group

- **Base dos elementos SVG.**
- **`to_svg` retorna `XMLElement`.**

### 17.9 — Primitives, BasicShapes, Text

- **~5 formas.**
- **~9 helpers de desenho.**

### 17.10 — Painter

- **Container de SVG.**
- **`to_svg` com `<svg>`.**

### 17.11 — FontMetrics

- **Dados de fontes (Liberation Sans).**
- **`width` com kerning.**

### 17.12–17.15 — Substituições

- **Cada substituição é uma subfase.**
- **Rodar testes das fases anteriores.**

### 17.16 — Golden tests

- **HTML/XML/ICalendar.**
- **~30 casos.**
- **Byte-a-byte.**

### 17.17 — Verificação

- **Sem `SimpleXMLElement` nem `PainterMin`.**
- **ADR 038.**

---

**Fim do arquivo de tarefas da Fase 17.**