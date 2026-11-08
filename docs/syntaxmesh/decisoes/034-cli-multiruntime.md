# CLI multi-runtime (`packages/cli`) e API de execução `execute`

**Status:** Aceito
**Data:** 2026-11-07
**Fase:** 24 (CLI `packages/cli`); consumidores: 19/20 (PWA, caminho passo-a-passo),
21 (runner dos goldens contra o `tj3` real) e 22 (extensão VS Code / MCP)

## Contexto

O SyntaxMesh precisa de uma interface de linha de comando equivalente ao `tj3`
original: ler arquivos de projeto (`.smx`, `.tjp` por compatibilidade) com os
`include`s, agendar e gerar relatórios/informações no terminal. A fonte de
verdade do comportamento é `docs/taskjuggler/lib/tj3.rb` +
`lib/taskjuggler/apps/Tj3.rb` (regra zero, ADR 011).

Três pressões moldaram a decisão:

1. **Banco de provas headless.** A CLI roda `parse → schedule → reports` sem
   browser, storage ou UI — é o caminho mais curto para exercitar o corpus
   (MWEs + TestSuite) contra o motor e comparar com o `tj3` Ruby.
2. **Multi-runtime.** A ferramenta precisa rodar em Deno (oficial), Node ≥ 20
   (bundle ESM) e Bun (smoke), sem duplicar implementação.
3. **O core é puro.** O motor não toca em disco, não imprime, não lê `argv` e
   não chama `exit()` (ADR 027 e a política de pureza das Fases 14/18). Toda
   decisão de execução (imprimir, gravar, colorir, sair) pertence ao
   consumidor.

As âncoras `NotYetImplementedError("24")` de `TaskJuggler.parse/parseFile/
parseContent/freeze` existiam justamente porque a fachada pressupunha
storage/browser. A Fase 24 é a dona dessas âncoras (reancoradas de 19 → 24 em
2026-11-03, xray §4).

## Decisão

1. **Novo pacote `packages/cli` (`@vanaware/syntaxmesh-cli`) no workspace Deno.**
   É **adaptador puro**: `argv` + FS + renderização. Nenhuma regra de linguagem,
   de scheduling ou de relatório vive ali; se aparecer, é bug de fronteira.

2. **Cliffy via JSR (`jsr:@cliffy/command`) para a interface.** v1 oficial roda
   em Deno, Node e Bun; fornece `--help`, tabelas de opções, cores ANSI e erro
   de flag desconhecida com `exit 1` sem request ao core.

3. **Camada única de compatibilidade `src/io.ts`,** com `node:fs/promises`
   (`readFile`/`writeFile`/`access`/`mkdir`/`mkdtemp`) inclusive no Deno — o shim
   é nativo nos três runtimes, então **zero ramificação de FS**. A única
   ramificação restante é `args` (`Deno.args` vs `process.argv.slice(2)`) e
   `exit`, uma linha cada, mantidas por testabilidade (injeção em teste).
   Acesso ao global é por interface tipada (`RuntimeGlobals`), **sem `any`**,
   mesma convenção do lexer do core.

4. **Desancoramento de `TaskJuggler.parse/parseContent/parseFile` por provedor
   de conteúdo injetado** (`(path) => string | Promise<string>`), para o caminho
   **passo-a-passo** (UI/PWA, Fase 20). O core continua sem tocar em disco: o
   provedor é injetado no `Scanner`/`FileStreamHandle` (`fileLoader` de
   instância). `freeze` permanece ancorado até a subfase 24.9.

5. **API de execução única `core.execute(request): Promise<ExecutionResult>`**
   como ponto único de entrada das chamadas de linha de comando (adendo
   `fase-24-cli-adendo.md` v2/v2.1). O request carrega os arquivos **inline**
   (`files[]` de `{ path, content }` — fechamento completo de `include`s) e o
   core resolve `include` por *lookup* em memória, **sem provedor e sem disco**.
   O envelope devolve `ok`, `exitCode` (dado), `options` (eco normalizado, só
   caminhos dos arquivos), `messages` estruturadas e `results` com **apenas as
   seções pedidas** (`check`, `listReports`, `reports`, `freeze`, `sheet`,
   `man`, `help`, `version`). O core orquestra o pipeline; o consumidor não
   encadeia `parse`/`schedule`/`render`.

6. **Contrato de saída = modificador `stdout` na DSL + seção `reports`.**
   `stdout` é um booleano de **intenção** (posição: depois do nome, antes das
   chaves), gravado como atributo do relatório; o core só o reflete no JSON. A
   política — imprimir com delimitador `--- <name> [<format>] ---` ou gravar
   `{name}.{ext}` sanitizado no `outputDir` ecoado — é **exclusiva da CLI**
   (`output-policy.ts`).

7. **`exitCode` como dado.** O core calcula a matriz fiel a `apps/Tj3.rb`
   (`0` sucesso/`--check-syntax` OK; `1` erro de parse/relatório/warnings com
   `--abort-on-warnings`), incluindo `forceReports`; a CLI só chama
   `io.exit(result.exitCode)`. Nenhum `exit()` nasce no core — precedente dos
   apps de sheet da Fase 18 (`run()` devolve o código).

8. **English-first.** Toda superfície emitida pela ferramenta (mensagens,
   `--help`, `version`, `man`, templates de sheet, README) é em inglês. O i18n
   da Fase 10 permanece como capacidade de **entrada** (parsear pt-BR/es para a
   regra zero e os goldens F21); nenhuma saída segue o idioma do arquivo.

9. **Extensão nativa única `.smx`** (decisão 2026-11-07), com `.tjp`/`.tji`
   aceitos por compatibilidade. A distinção master/include passa a ser de papel
   (`entry` vs. referenciados por `include`), que é exatamente a semântica de
   `request.files`/`entry` — o *lookup* de include é por **caminho**, nunca por
   extensão.

## Alternativas rejeitadas

- **`Deno.args` + `Deno.readTextFile` puros.** Mata Bun/Node e contradiz o
  requisito multi-runtime.
- **`@std/cli` sozinho.** Perde a UX de ajuda/tabelas/cores do Cliffy; o custo
  é reimplementar o parser de opções do `OptionParser` do Ruby à mão.
- **Driver de abstração de storage.** Overkill: o problema é **runtime**, não
  storage (ADR 030/037). `io.ts` resolve; um store extra só criaria divergência
  com a PWA.
- **`FileSink` injetado em `generateReports`.** Vazava política de saída para o
  core. Substituído pelo modificador `stdout` na DSL + seção `reports` do
  envelope.
- **Orquestrar o pipeline na CLI com `renderReports` como entrada pública
  (desenho v1).** Substituído pela fachada única `execute` (adendo v2): a
  orquestração mora no core e o consumidor só consome dados.

## Consequências

### Positivas

- Um único contrato JSON-serializável serve CLI, MCP, extensão VS Code, worker
  da PWA e testes — sem fork de API e sem orquestração duplicada.
- O core permanece puro e testável; a CLI vira transporte + renderização.
- `include` resolvido por *lookup* elimina a última costura de I/O do core no
  caminho de linha de comando (nenhum provedor, nenhum disco).
- A CLI é o runner da 1ª onda da Fase 21 (goldens contra o `tj3` real).

### Negativas / Riscos

- O consumidor precisa montar o **fechamento completo** de arquivos
  (`include` ausente da lista é erro de arquivo, como no `tj3`). É trabalho
  explícito da CLI/consumidor, documentado no README do pacote.
- `node:*` aparece no workspace pela primeira vez, confinado a `io.ts`
  (auditado por teste).
- `MessageHandlerInstance`/`DataCache` são singletons de processo: uso
  concorrente exige **instância `TaskJuggler` dedicada por chamada** e snapshot
  de mensagens por `execute` (requisito reafirmado no adendo §3.6).
- O envelope não devolve conteúdo de arquivo: quem precisar do texto do projeto
  deve retê-lo no chamador (decisão deliberada de tráfego).

### Neutras / Observações

- `--debug`/`--debuglevel`/`--debugmodules` ficam fora da v1 (hook de log do
  Ruby); depuração usa testes e `--add-trace`.
- `freeze` (24.9) e apps de sheet/`dynamicAttributes` (24.10) são extensões
  pós-v1, dependentes das Fases 18/22, e entram pela **mesma** API `execute`
  (seções `freeze`/`sheet`/`man`), nunca por caminho paralelo.
- A DAEMON suite (`tj3d`/`tj3webd`/`tj3client`) está fora de escopo: a
  funcionalidade análoga vem da Fase 22 (camadas daemon/relatórios), que
  reaproveita `execute`.

---

**Status:** Aceito
**Data:** 2026-11-07
**Autor(es):** SyntaxMesh (port TS-only)
