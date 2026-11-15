# Corpus de fixtures — golden e2e (Fase 21, 1ª onda)

> **ADR:** [042 — Estratégia de validação](../../docs/syntaxmesh/decisoes/042-estrategia-validacao.md)
> **Manifesto:** [`corpus.json`](./corpus.json) (gerado — `deno task corpus:generate`)
> **Oracle:** `scripts/golden/cli-tj3.rb` · **Runner:** a CLI `syntaxmesh` (F24)
> via `packages/cli/tests/e2e_<grupo>_test.ts` (harness `golden/e2e-harness.ts`)

## Política

As fixtures são **referenciadas no lugar**, nunca copiadas (ADR 042): as
fontes abaixo já são commitadas e os goldens por feature (parser/reports/
gantt) as leem diretamente. O manifesto `corpus.json` é o inventário único
consumido pelo oracle Ruby e pelo teste runner — uma cópia física derivaria
silenciosamente da fonte.

Os expected JSONs gerados pelo oracle são commitados: **o CI não depende de
`tj3` instalado**; só a regeneração (`deno task golden:generate`) depende.

## Grupos (contagens medidas 2026-11-15)

| Grupo | Fonte | Fixtures | O que exercita |
|---|---|---|---|
| `mwe` | `docs/Learning/mwe001–009/tutorial.tjp` | 9 | tutoriais completos (include, relatórios, finance) |
| `syntax-correct` | `docs/taskjuggler/test/TestSuite/Syntax/Correct/` | 75 | sintaxe válida da linguagem |
| `syntax-errors` | `docs/taskjuggler/test/TestSuite/Syntax/Errors/` | 94 | diagnósticos (primeira mensagem `file:line`) |
| `scheduler-correct` | `docs/taskjuggler/test/TestSuite/Scheduler/Correct/` | 35 | agendamento válido |
| `scheduler-errors` | `docs/taskjuggler/test/TestSuite/Scheduler/Errors/` | 70 | erros de agendamento |
| `report-generator` | `docs/taskjuggler/test/TestSuite/ReportGenerator/Correct/` | 9 | pipeline de relatórios |
| `html-reports` | `docs/taskjuggler/test/TestSuite/HTML-Reports/` | 13 | relatórios HTML (incl. Gantt) |
| `csv-reports` | `docs/taskjuggler/test/TestSuite/CSV-Reports/` | 18 | relatórios CSV |
| `export-refs` | `docs/taskjuggler/test/TestSuite/Export-Reports/refs/` | 68 | projetos de referência de export (MSPDI) |
| `parity` | `packages/cli/tests/fixtures/golden/*.smx` | 4 | paridade de conteúdo (CSV byte, HTML DOM) |
| **Total** | | **395** | |

## IDs

`<grupo>/<stem>` — o prefixo do grupo garante unicidade entre diretórios
(`Account.tjp` existe em `Syntax/Correct` e em `Export-Reports/refs`).
Fixtures `mwe` usam o nome do diretório do tutorial (`mwe/mwe001`).

## Regenerar o manifesto

```bash
deno task corpus:generate   # varre as fontes e reescreve corpus.json
deno task cli:test          # o teste de sync acusa manifesto desatualizado
```

O contrato do manifesto (contagens por grupo, caminhos existentes, ids
únicos, sync do commitado) é testado em
`packages/cli/tests/golden/corpus_test.ts`.

## Triagem de divergências

Default: divergência é **bug do port** (o Ruby é a fonte de verdade).
Destinos e registro: `packages/cli/tests/golden/known_divergences.md` +
`known-divergences.json` (26.6). Nunca `it.ignore` silencioso.