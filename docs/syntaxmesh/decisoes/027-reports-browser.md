# ADR 027 — Reports no browser: retorno de strings

> **Status:** ✅ Aceito
> **Data:** 2026-10-30
> **Autores:** Qoder

## Resumo

O `Report.generate` do TaskJuggler escreve arquivos em disco (HTML, CSV, TJP,
MSP XML, iCal, Niku, ctags). O SyntaxMesh roda 100% no browser, sem filesystem
direto. Decidimos que **relatórios retornam o conteúdo como `string`** em vez de
escrever em disco; a persistência (download, OPFS, IndexedDB) é responsabilidade
das camadas de UI/Storage (Fases 19/20).

> **Nota de numeração:** o plano (`fase-14-relatorios.md`) e o arquivo de tarefas
> pedem "ADR 024/025/026" para esta decisão, mas todos já foram consumidos
> (024 = expressões lógicas, 025 = RichText, 026 = Markdown). O README já
> reservava o **027** para *Reports no browser: retorno de strings*; usamos 027.

## Contexto

No Ruby, `Report#generate` percorre os formatos pedidos e, para cada um, abre um
arquivo em `AppConfig.outputDir` e escreve o resultado (`generateHTML`,
`generateCSV`, `generateTJP`, `generateMspXml`, `generateNiku`, `generateICal`,
`generateCTags`). Há também `copyAuxiliaryFiles`, que copia CSS/ícones para o
diretório de saída.

No browser:

- não há `File.open` nem filesystem síncrono;
- escrever arquivo exigiria OPFS/`worker-db` (Fase 19) ou um download via UI
  (Fase 20);
- o core é DOM-free e não conhece storage (ADR 001, ADR 003).

## Decisão

1. **`Report#generate` retorna strings.** Em vez de escrever em disco, cada
   gerador produz o conteúdo e o expõe. A API pública é:
   - `generate(requestedFormats?): number` — orquestra e acumula saídas
     (mantém o retorno numérico do Ruby para contagem de erros);
   - `lastOutputs(): ReportOutput[]` — array de `{ format, name, content }`
     produzido pela última geração, para a UI consumir.
   Os geradores privados (`generateHTML`, `generateCSV`, …) retornam
   `string | null` / `unknown[][] | null` em vez de escrever.
2. **`outputDir` é mantido por compatibilidade, mas opcional.** `Report` ainda
   lê/resolve `outputDir` e `absoluteFileName` (nome lógico do artefato), só que
   nenhum caminho toca o disco. A UI usa `name` como sugestão de filename no
   download.
3. **`copyAuxiliaryFiles` é no-op.** CSS/ícones são servidos via `fetch` +
   Service Worker na Fase 20; o core não copia assets.
4. **`CSVFile.write/read` adaptados ao browser.** `write('.')` é sem efeito
   (a string já está disponível via `to_s()`); `read(fileName)` exige um
   `FileStore` injetável — sem ele, lança `NotYetImplementedError` (Fase 19).
5. **XML/HTML usam `XMLElementLike`.** Até a Fase 17 entregar `XMLElement`/
   `HTMLDocument`, os relatórios montam a árvore via `XMLElementLike`
   (Fase 12) e a serializam com `toHTML()`. Um `HTMLDocument` mínimo local é
   suficiente para embrulhar o corpo do relatório.

## Consequências

### Positivas

- Core permanece DOM-free e storage-free (ADR 001/003): relatórios são funções
  puras `modelo → string`.
- Testável sem filesystem: basta comparar a string retornada (golden tests
  normalizam HTML/CSV).
- A camada de UI decide o destino (preview, download, OPFS) sem o core saber.

### Negativas / Riscos

- **Assinatura diverge do Ruby** (`generate` não escreve). Mitigação: documentar
  aqui; o `name` preserva o nome de arquivo lógico.
- `lastOutputs` é estado mutável do `Report`; chamadas concorrentes precisam de
  instâncias separadas (já é o modelo por-report).
- Relatórios gigantes ficam inteiramente na memória como string. Aceito para os
  MWEs; otimização de streaming fica para Fase 21.

### Neutras / Observações

- `timeSheet`/`statusSheet` permanecem stubs ancorados na Fase 18.
- `ICalendar`/`Painter` são implementados em versão **mínima** nesta fase;
  a Fase 17 os substitui por completo.

---

## Adendo (14C.5.12) — dialeto do RichText nos relatórios: default `richtext`, markdown opt-in

O conteúdo RichText de um relatório (`header`, `footer`, `prolog`, `epilog`,
`intro`, `caption` e o `details` de `journalentry`) é MediaWiki por default.
Markdown entra apenas por `format markdown` explícito no escopo do relatório
(ou da entrada do diário), nunca por detecção de sintaxe nem por configuração
global.

**Decisão**

- O atributo `format` (`Symbol`, default `richtext`, `inheritedFromParent`) foi
  adicionado em `report-attributes.ts`; o parser escolhe a fábrica
  (`RichTextFactoryImpl` × `MarkdownFactory`, Fase 13) ao criar o RTI
  (`newRichText(text, sfi, tokenSet, format)`).
- A ordem dos atributos não importa: o parser registra cada fonte em
  `Report.richTextSources` e `applyReportFormat()` reconstrói os RTIs já lidos
  (via `force()`, porque `set()` dispara `AttributeOverwrite`).
- As duas fábricas produzem o **mesmo** `RichTextIntermediate`, então
  `rt_to_html()`/`rt_to_s()`, `TableReport` e `TextReport` não mudaram de API.
  O único ajuste foi reinterpretar RTIs que nascem como MediaWiki (`note` de
  propriedade, `celltext` crua) com a fábrica markdown quando o relatório pede
  (`ReportBase#rtiForReport`/`#cellTextForReport`).

**Por quê**

- Compatibilidade `.tjp`: os arquivos existentes (e os goldens do Ruby) usam
  `'''forte'''`, `//itálico//`, `== seção ==`; trocar o default quebraria todos
  de uma vez e tornaria a divergência indistinguível de bug.
- Coexistência: o mesmo projeto pode ter um relatório legado e outro novo;
  herança pelo relatório-pai permite `format markdown` num bloco e esquecer do
  resto.

**Alternativas rejeitadas**

- Detecção automática de sintaxe: ambíguo (`#` é título em markdown e texto em
  MediaWiki), impossível de testar deterministicamente.
- Default markdown: quebra os `.tjp` existentes e os goldens do Ruby.
- Atributo global de projeto: impede migração incremental por relatório.

**Consequências / limites conhecidos**

- A galeria do RDO (`picturesFromDetails`, 14C.3.7) é agnóstica de dialeto:
  coleta `![alt](path)` e `[[Image:path|alt]]` na mesma varredura, então o
  `format` da entrada decide a renderização do texto, não a coleta.
- A sanitização de HTML cru é **por nó mdast** (`mdast-to-richtext`): tags
  bloqueadas e atributos de evento não atravessam, mas o corpo de um
  `<script>` pode sobrar como texto inerte (escape), não como código.
- Nota 2026-11-07 (Fase 24, tarefa 24.2.34): na fronteira `execute` não há
  provider de leitura — `CSVFile.read` continua ancorado (Fase 19) e falha
  com `NotYetImplementedError` citando a fase; o caminho `write` é no-op e
  **avisa em inglês** (`csv_write_noop`). Consumidores passo-a-passo/PWA
  seguem livres para injetar leitura própria (ADR 037, aditamento v2.1).
- `celltext` é string crua no TaskJuggler; num relatório markdown ela é
  interpretada como markdown — desvio consciente para manter paridade de
  leitura com `note`/`header`.
- `[[query:attribute=name]]` continua vazio: `name`/`projectid`/`version` do
  projeto são campos (`Project.name`), não atributos consultáveis (gap
  pré-existente, fora do escopo deste adendo).

**Verificação:** `markdown-report_14c_test.ts`, `markdown-handlers_14c_test.ts`
e `markdown-content_14c_test.ts` (14C.5.1–5.9) + bloco `markdownReports` do
`reports-extensions.golden.json` (14C.5.11).

---

**Status:** Aceito
**Data:** 2026-10-30
**Autor(es):** Qoder
**Implementação:** `packages/core/src/reports/` (Fase 14)
**Referências:** ADR 001, ADR 003, ADR 025, `docs/syntaxmesh/fases/fase-14-relatorios.md`
