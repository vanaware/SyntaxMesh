# Divergências conhecidas — golden CLI × `tj3` (Fase 24.7)

> **Fase:** 24.7.5 · **Golden:** `packages/cli/tests/golden/cli-tj3.golden.json`
> **Oracle:** `scripts/golden/cli-tj3.rb` · **Teste:** `packages/cli/tests/golden_cli_test.ts`
> **Política:** `scripts/golden/README.md` § "Golden CLI × tj3" e Regra 1 (o Ruby
> é a fonte de verdade; divergência é bug do port até prova em contrário).

## Por que este arquivo existe

O golden compara o que o usuário vê: código de saída, arquivos gravados,
mensagens e stdout. Toda diferença que **não** é comparada hoje precisa de
âncora aqui — na linha do caso, no `compare` do fixture ou numa exclusão do
subset. Sem âncora, a diferença volta como falha silenciosa meses depois.

Três destinos possíveis para uma divergência:

| Destino                     | Quando                                                                                          | Efeito no golden                                |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Normalização**            | a diferença é de representação, não de comportamento (carimbo, id de tooltip, caminho absoluto) | comparado depois de normalizar                  |
| **Sub-critério mais fraco** | o port acerta o essencial e erra a forma (ex.: falta a linha `Total` de um CSV)                 | `compare: "artifacts"` — só `exit` + inventário |
| **Fora do subset**          | o port **falha** onde o `tj3` funciona (bug do core)                                            | o caso sai do `.rb`, com a razão no comentário  |

Nenhum caso é ignorado por `it.ignore`: ou é comparado, ou não entra no
subset. A triagem de todos eles é da 1ª onda da Fase 21 (golden completo ×
`tj3`), que regenera a matriz de completude.

## Registro

| #      | Divergência                                                                                                                                                                                                                                                                                 | Onde                          | Golden                                                                                                                             | Âncora                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **D1** | UI de terminal: o `tj3` imprime banner GPL (11 linhas) + barra de progresso com `\r`; a CLI imprime o resumo do projeto (24.4.5).                                                                                                                                                           | stdout dos dois lados         | os dois são filtrados; sobra o **resíduo**, comparado e vazio                                                                      | `cli-tj3.rb#strip_banner`, `golden_cli_test.ts#residue`           |
| **D2** | `accountreport` em modo **balance**: o `tj3` fecha a lista com uma linha `Total` (um `Account` temporário que adota a conta de custo e a de receita, `AccountListRE#generateIntermediateFormat`) e numera cada lista do zero; o port não gera a linha.                                      | `parity-csv-balance.smx`      | `compare: "artifacts"` — `exit` + inventário                                                                                       | fixture + este verbete                                            |
| **D3** | Serialização de célula em CSV (`CSVFile#marshal`): (a) `Float` inteiro sai `4.0` no Ruby e `4` no port; (b) célula vazia sai `""` no Ruby e vazia no port; (c) célula em erro sai `""` no Ruby e `<Error>` no port.                                                                         | relatórios CSV                | os 2 fixtures byte a byte só usam colunas de texto/data/percentual (`id`, `name`, `start`, `end`, `priority`, `complete`, `index`) | `parity-csv-{tasks,accounts}.smx`                                 |
| **D4** | Conjunto de **avisos** difere: o port emite `priority_inversion` e `*_check_unsupported` no `schedule()`, que o Ruby só avalia com o motor de queries; o Ruby emite `no_reports` (projeto sem relatório) e um aviso extra de `balance` ausente, que o port não emite.                       | `messages` / `stderr`         | só a **primeira mensagem** dos fixtures de erro é comparada; nos demais, `messages` é informativo                                  | `cli-tj3.rb` (comentário "Por que não comparar tudo")             |
| **D5** | Envelope do HTML: `<head>` do `tj3` traz `description`/`keywords`; o `<link>` de css, o comentário "generated by tj3" e a linha de copyright ("… with SyntaxMesh") são do produto.                                                                                                          | `parity-html.smx`             | DOM canônico: `<body>` apenas, envelope fora, `ID<n>`/`<TS>` estabilizados                                                         | `canonical-dom.ts`                                                |
| **D6** | Geometria de **Gantt** (posição de barras, setas, `nowLineX`) não é comparada pela CLI — a cobertura é o golden dedicado da Fase 15.                                                                                                                                                        | relatórios com coluna `chart` | nenhum fixture de paridade tem `chart`                                                                                             | `scripts/golden/gantt-common.rb`                                  |
| **D7** | `Learning/mwe004`: `task_start_in_parent` espúrio em `deliveries.start` (marco fixado no começo do projeto é comparado com o início do pai e acusa "antes" com a mesma data impressa). A CLI sai com `1` e nenhum artefato; o `tj3` sai com `0`.                                            | scheduler do core             | **fora do subset**                                                                                                                 | `cli.integration_test.ts` (`it.ignore` da 1ª onda) + `cli-tj3.rb` |
| **D8** | `Syntax/Correct/AccountReport`: `effort 20m` (20 **meses**) com duas alocações de **grupo** estoura o intervalo do projeto no port (`173.5d of effort … does not fit into the project time frame`) e não no `tj3`. Tarefa de um recurso só passa; o que quebra é a competição entre grupos. | scheduler do core             | **fora do subset**                                                                                                                 | `cli-tj3.rb` (comentário)                                         |
| **D9** | `Syntax/Correct/Leave`: `resourcereport "."` faz o `tj3` escrever o HTML no **stdout**; o port com `--output-dir` sempre grava em disco.                                                                                                                                                    | output policy                 | **fora do subset** (a cobertura de `leaves` é `scripts/golden/leaves.rb`)                                                          | `cli-tj3.rb` (comentário)                                         |

## Especificidades do `tj3` que **não** são divergência

Registradas porque surpreendem ao ler o golden:

1. **`-o` exige diretório existente** (o oracle cria o temporário antes).
2. **Extensão tem de ser `.tjp`** — os fixtures de paridade (`.smx`) são
   copiados para um temporário, e é a cópia que aparece normalizada como
   `<PATH>` nas mensagens.
3. **`Error` encerra o processo** (`MessageHandler#error` → `exit 1`), então o
   golden de um fixture de erro tem **uma** mensagem comparável; as demais
   linhas do stderr são a cascata do FSM do port e ficam fora (D4).
4. **O `tj3` imprime a linha de fonte ofensora** depois da mensagem de erro; o
   port não repete o texto do `.tjp`. Só a linha `file:line: Severity: texto`
   entra na comparação (24.7.8).
5. **`effort 20m` é 20 meses**, não 20 minutos (`m` = month). Foi o que
   delatou D8.
6. **Relatório sem `formats` gravado em `"."`** vira `resourcereport "."`
   (D9): `"."` é diretório, não arquivo.
7. **Coluna de série temporal (`daily`, `weekly`…) gera uma célula por
   período** e repete o cabeçalho com a data (`"2026-01-05";"2026-01-05";…`),
   mais as células do calendário anterior (`2025-12-29`…) no fim. Não é bug —
   é o `Report` montando uma coluna por slot da escala.

## Como adicionar uma divergência

1. Reproduza com `ruby scripts/golden/cli-tj3.rb` e a CLI no mesmo fixture.
2. Classifique nos três destinos acima — o default é **bug do port**.
3. Se for bug do core fora do escopo da CLI, tire o caso do subset no `.rb` e
   escreva a razão **no comentário acima da lista** (a lista é a fonte do
   subset, não este arquivo).
4. Se for de forma, ajuste o `compare` do fixture ou a normalização — nunca
   compare menos sem registrar aqui.
5. Rode `deno task golden:generate:ruby && deno task cli:test`.

## Ponto de saída

D2, D3 e D4 são de **relatório/serialização** e saem com o golden completo da
Fase 21. D7 e D8 são de **scheduler** e saem quando o `Project.schedule()` for
reconciliado com o `Project.rb` na 1ª onda da Fase 21. D1, D5, D6 e D9 são
**arquiteturais** (produto, envelope, golden dedicado, política de saída) e
permanecem.
