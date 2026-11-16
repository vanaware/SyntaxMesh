# Estratégia de validação (Fase 21 — 3 ondas)

**Status:** Aceito
**Data:** 2026-11-15
**Fase:** 21 — Compatibilidade e Qualidade (1ª onda; o número 033 do plano
original foi ocupado pelo template da Fase 23 — próximo livre após 041)

## Contexto

O SyntaxMesh é um port fiel do TaskJuggler 3.8.4 (ADR 011). Provar essa
fidelidade exige mais do que testes unitários: é preciso rodar o **mesmo
corpus** pelo `tj3` real e pelo port e comparar o que o usuário vê. Além da
fidelidade do motor, a fase precisa provar equivalência multilíngue
(en ↔ pt-BR ↔ es), estabilidade (snapshots), performance (benchmarks com
baseline) e — nas ondas seguintes — segurança, cross-browser, acessibilidade
e qualidade de release.

O reescopo de 2026-11-03 (plano §0) fatiou a Fase 21 em **3 ondas** que
acompanham os consumidores do motor: 1ª após a Fase 24 (motor, via CLI),
2ª após a Fase 22 (extensão VS Code), 3ª após a Fase 20 (PWA + UI + release).
Cada onda testa o que existe até ali e congela os resultados como baseline
da seguinte.

Duas infraestruturas já existiam quando a 1ª onda abriu:

1. **Goldens por feature** (Fases 2–18): scripts Ruby em `scripts/golden/`
   geram `.golden.json` commitados; testes Deno comparam método a método
   (parser 178 casos, reports 61, gantt, richtext, finance, sheets, …).
2. **Golden e2e da CLI** (F24.7): `cli-tj3.rb` roda o `tj3` real sobre um
   subset de 34 fixtures e `golden_cli_test.ts` roda a CLI de verdade sobre
   os mesmos, comparando exit, inventário de artefatos, resíduo de stdout,
   primeira mensagem de erro, CSV byte a byte e HTML por DOM canônico.

A pergunta da fase é como escalar isso para o corpus completo (~391
fixtures) sem construir um terceiro mecanismo paralelo.

## Decisão

1. **Golden tests contra o `tj3` real são o critério primário de
   fidelidade.** O sujeito é sempre a **CLI `syntaxmesh` da Fase 24** —
   nada de runner próprio (`tj3-ts-runner`). O harness e2e da F24.7
   (`cli-tj3.rb` + `golden_cli_test.ts` + `canonical-dom.ts`) é estendido
   para o corpus completo, organizado em grupos (mwe, syntax-correct,
   syntax-errors, scheduler-correct, scheduler-errors, reports,
   export-refs). Os goldens por feature continuam como camada de
   granularidade fina; o e2e é a camada de aceitação.

2. **Corpus referenciado no lugar.** `docs/Learning/mwe*` e
   `docs/taskjuggler/test/TestSuite/` já são commitados; o índice/manifesto
   vive em `tests/fixtures/` (README + `corpus.json`). Não se copia fixture
   — cópia duplicaria a fonte e derivaria. Os expected JSONs são commitados:
   **o CI não depende de `tj3` instalado**; só a regeneração
   (`deno task golden:generate`) depende.

3. **Política de divergência (da F24.7, elevada a regra da fase).** O Ruby
   é a fonte de verdade; divergência é **bug do port até prova em
   contrário**. Três destinos: normalização (diferença de representação),
   sub-critério mais fraco (o port acerta o essencial), ou fora-do-subset
   com âncora e justificativa. **Nunca `it.ignore` silencioso.** Toda
   divergência aceita entra no registro (`known-divergences.json` +
   `known_divergences.md`) com fixture, descrição, justificativa, mitigação
   e prioridade; features não portadas vão para `10-futuro.md`. Uma
   divergência encontrada numa onda posterior pode corrigir a fase culpada;
   a onda seguinte revalida sobre a correção.

4. **AST equivalence para i18n.** Cada fixture existe em en/pt-BR/es
   (tradução mecânica de keywords; strings e IDs preservados); o teste
   parseia as três versões e compara o snapshot estrutural normalizado
   (`normalizeAST` — `name` de task/resource vira `__TASK__`/`__RESOURCE__`).
   Alvo da 1ª onda: ≥ 30 fixtures × 3 idiomas. O caminho pt/es é
   **experimental** (decisão 2026-11-07): prova piso de compatibilidade do
   parser, não via recomendada ao usuário.

5. **Regression snapshots** (`@std/testing/snapshot`) congelam AST,
   diagnostics, serializações de RichText e reports normalizados.
   Snapshot divergiu → revisão manual → aceitar ou corrigir.

6. **Benchmarks com baseline.** `deno bench` em ≥ 10 cenários
   representativos (parse/schedule/reports/gantt/richtext/query);
   `bench/baseline.json` commitado; `bench:compare` falha com regressão
   > 20%. A otimização final (26.14) ataca os top-3 hotspots medidos.

7. **Ondas 2/3 herdam a estratégia, não a redefinem.** 2ª onda: integração
   LSP, grammar sobre o corpus, performance do `lsp-core`, aceite `.vsix`
   (handoff da F22). 3ª onda: segurança (OWASP vectors), CSP, Playwright
   cross-browser (Chromium/Firefox/WebKit), `axe-core`, Lighthouse ≥ 90,
   build de produção, CHANGELOG, SemVer 1.0.0, CI/CD final.

8. **Relatório de conformidade gerado.** `scripts/golden/generate-report.ts`
   produz `docs/syntaxmesh/conformance-report.md` (resumo, por categoria,
   divergências, features ausentes, versões `tj3 3.8.4` × port) a partir
   dos goldens e do registro de divergências — nunca editado à mão.

## Alternativas rejeitadas

- **Testes manuais.** Frágeis, não reproduzíveis, não escalam para 391
  fixtures × 2 implementações.
- **Apenas unit tests.** Provam o método, não o produto: exit code,
  artefatos gravados e mensagens do usuário final ficam sem cobertura.
- **Runner `tj3-ts` próprio.** Proibiria testar o que o usuário vê (argv,
  disco, stdout reais) e duplicaria a CLI; a diretriz da onda é explícita.
- **Copiar o corpus para `tests/fixtures/`.** O plano original pedia cópia;
  a fonte já é commitada e os goldens existentes leem `docs/` diretamente —
  uma segunda cópia derivaria silenciosamente. O índice cumpre o papel de
  organização sem duplicação.
- **Comparar HTML byte a byte.** Carimbo de criação, ids de tooltip e
  assinatura do produto mudam por construção; o DOM canônico (24.7.7)
  compara a carga útil.

## Consequências

### Positivas

- Fidelidade provada ponta a ponta contra o oráculo real, no mesmo corpus
  que o projeto TaskJuggler usa para se testar.
- CI verde sem Ruby: os expected JSONs são commitados e idempotentes
  (regra de byte-idempotência do `scripts/golden/README.md`).
- Uma única política de divergência para todas as camadas; nada é ignorado
  em silêncio e toda exceção tem âncora.
- As ondas 2/3 reusam corpus, normalizadores e registro — o custo marginal
  de cada onda é só o adapter do consumidor.

### Negativas / Riscos

- **Custo de manutenção:** cada correção do core pode exigir regenerar
  goldens (`deno task golden:generate` + revisar o diff).
- A regeneração exige `tj3` 3.8.4 + Ruby no ambiente de desenvolvimento;
  versões diferentes do oráculo mudariam o expected (o ambiente fixa 3.8.4).
- A triagem do corpus completo expõe divergências reais do scheduler
  (D7/D8 e outras) — corrigi-las é trabalho de core dentro da onda, não
  um apêndice.

### Neutras / Observações

- O número deste ADR é **042**; as referências a "ADR 033" no plano e nas
  tarefas da Fase 21 são históricas (o 033 foi ocupado pelo template).
- A 1ª onda já havia entregado a regeneração da `completude-matrix.md` e a
  reconciliação 033–037 (26.22.9–11, 2026-11-10) antes deste ADR; o
  remainder (26.0–26.11, 26.14, 26.26–26.28) foi autorizado pelo usuário
  em 2026-11-15, após o fechamento da Fase 22.
- 26.12 (segurança) e 26.13 (CSP) pertencem à 3ª onda (plano §0), não à 1ª.

## Adendo — 2ª onda (21², 2026-11-15)

A 2ª onda (26.29–26.33) adaptou a suite à extensão VS Code (handoff da F22),
consumindo a decisão 7 ("ondas 2/3 herdam a estratégia"). O ambiente não tem
VS Code desktop nem vscode.dev, então a onda é **headless-first + âncora**
(escolha do usuário, 2026-11-15):

1. **Tudo o que é provável em Deno puro é entregue e gatado.** A integração
   LSP roda sobre o transporte **stdio JSON-RPC real** (`registerLspServer`,
   sem editor): o harness `StdioClient` (26.29.1) cobre a superfície §5
   completa — capabilities, didChange full/incremental, didClose, completion,
   definition, references single+cross-file, documentSymbol/workspaceSymbol/
   semanticTokens, diagnósticos de fixture de erro do corpus e pureza de
   stdout. A grammar TextMate é tokenizada **headless** via
   `npm:vscode-textmate` + `npm:vscode-oniguruma` (WASM), imports **test-only**
   que não entram em bundle nenhum (fronteira `lsp-core` intacta); a v1 é
   EN-only, então a tokenização alvo nas fixtures EN do corpus e keywords
   não-EN caem no escopo raiz (limitação documentada, não falha). Os
   diagnósticos lsp-core em arquivo grande têm benchmark com baseline
   (`bench/lsp_bench.ts`, grupo `lsp`). Manual/help EN e o `.vsix` estrutural
   (+ pureza web, injeção de versão, smoke do bundle construído sobre stdio)
   são revalidados.

2. **O aceite runtime VS Code fica diferido com âncora explícita.** Test
   Runner de comandos/trust, instalação limpa (`code --install-extension`) e
   vscode.dev exigem um Extension Host vivo — ausente aqui. Permanecem como
   **handoff para uma execução equipada com VS Code**, não forçados para a 3ª
   onda (PWA/UI/release). **Nenhum `it.ignore` silencioso** (decisão 3): a
   evidência headless correspondente está entregue e gatada; só o runtime
   fica pendente, registrado na matriz de aceite F21² (26.33.1) + F22 §11/§P7.

3. **Sem número novo de ADR.** Este adendo estende a 042 (já o ADR de
   estratégia das 3 ondas); a política de divergência/âncora (decisão 3) e a
   herança de estratégia (decisão 7) aplicam-se sem alteração. O smoke do
   bundle construído é **evidência** (driver `tests/smoke-bundle.ts`, não
   `*test.ts`), para não impor dependência de pré-build ao gate.

---

**Status:** Aceito
**Data:** 2026-11-15
**Autor(es):** SyntaxMesh (port TS-only)