# Especificação: API de Execução do SyntaxMesh (envelope JSON) e parâmetro `stdout`

> **v2 (2026-11-07):** a API deixou de ser apenas de relatórios. Ela é agora o
> **ponto único de entrada** para todas as chamadas que qualquer consumidor
> (CLI, MCP, editor, testes) faz ao core — cobrindo o pipeline do `tj3` e as
> funções portadas de todos os apps de linha de comando do TaskJuggler
> (`Tj3Man`, `tj3ts_*`, `tj3ss_*`, `freeze`). O contrato de relatórios da v1
> (`stdout`, `formats[]`, `errors[]`) permanece válido, agora como **uma seção**
> do envelope.
>
> **v2.1 (2026-11-07):** `execute` **não** recebe provedor/callback de leitura
> de arquivo. O conteúdo chega **inline** como uma lista `files[]` de
> `{ path, content }` — o **fechamento completo** de arquivos, porque um `.tjp`
> pode referenciar outros `.tjp`/`.tji` via `include`. O core resolve os
> `include` contra essa lista, sem tocar em disco. Os **conteúdos não
> reaparecem no envelope** (o eco traz só os caminhos), para poupar tráfego e
> tamanho do retorno.

## 1. Objetivo

Definir a **API de execução do core** (`execute`): o consumidor monta um
*request* com todas as opções já traduzidas (sem orquestrar o pipeline) **e com
o conteúdo dos arquivos inline** — uma lista `files[]` de `{ path, content }`,
não um provedor/callback de leitura — e o core devolve um **envelope JSON** com
(a) o eco dos parâmetros recebidos, (b) uma **seção identificada por tipo de
resultado** (`check`, `listReports`, `reports`, `freeze`, `sheet`, `man`,
`help`, `version`) e (c) mensagens e `exitCode` como dados. Como um `.tjp` pode
referenciar outros `.tjp`/`.tji` via `include`, o consumidor passa o
**fechamento completo** de arquivos e o core resolve os `include` contra essa
lista — **sem acesso a disco**. Os **conteúdos não voltam no envelope** (o eco
`options` traz apenas os caminhos), para reduzir tráfego e tamanho do retorno. A
decisão efetiva de *como* executar — imprimir, gravar arquivo, colorir, sair do
processo — é responsabilidade exclusiva do consumidor (na v1, o pacote CLI),
mantendo o `core` puro e agnóstico de ambiente.

Adicionalmente, o mecanismo de **intenção de saída de relatórios**: um arquivo
`.tjp` declara com o modificador opcional `stdout` se um relatório deve ser
impresso no terminal ou gravado em arquivo; o core apenas registra a intenção
no JSON.

---

## 2. Novo parâmetro `stdout` na DSL `.tjp`

### 2.1 Sintaxe

O parâmetro `stdout` é um modificador opcional posicionado **após o nome do relatório e antes da abertura de chaves**:

```tjp
taskreport "Tarefas" stdout {
  formats csv, html
  columns name, start, end
}

resourcereport "Recursos" {
  formats csv
}

textreport "Resumo" stdout {
  formats txt
}
```

### 2.2 Regras

- `stdout` é **opcional**. Ausência significa `stdout: false`.
- `stdout` é um **booleano de intenção**, não uma ação. O `core` não imprime nada; apenas registra a intenção no JSON de retorno.
- `stdout` é aplicável a todos os tipos de relatório que o SyntaxMesh suportar (`taskreport`, `resourcereport`, `textreport`, `export`, `timesheetreport`, `statussheetreport`, etc.).
- Para relatórios cujo primeiro parâmetro é um nome de arquivo (`export`, `timesheetreport`, `statussheetreport`), o modificador `stdout` deve ser aceito da mesma forma, mantendo consistência sintática.
- A presença de `stdout` **não altera a validação** do relatório. Um relatório com `stdout` e múltiplos formatos é válido.
- Compatibilidade: arquivos `.tjp` sem `stdout` continuam funcionando exatamente como antes.

### 2.3 Parsing

O parser deve:
1. Reconhecer `stdout` como token válido no ponto indicado.
2. Armazenar o valor booleano no nó do relatório na AST.
3. Emitir erro de sintaxe se `stdout` aparecer em posição inválida (ex.: após as chaves, ou duplicado).

---

## 3. API do pacote `core`: `execute`

### 3.1 Método principal

O `core` expõe um método **único** para as chamadas de linha de comando
(acessível direto e via fachada `TaskJuggler.execute(request)`):

```ts
execute(request: ExecutionRequest): Promise<ExecutionResult>
```

Ele executa internamente todo o fluxo correspondente ao `tj3` — **a partir da
lista de arquivos recebida no request** (resolvendo `include` contra essa
lista, **sem provedor de arquivo e sem acesso a disco**) → parse → gates →
schedule → relatórios com atributos dinâmicos → operações pontuais como
freeze/list/man/sheets — e devolve o envelope completo. O consumidor **não
orquestra o pipeline** e **não precisa reexaminar as opções que passou**: o
envelope traz o eco dos parâmetros (só os caminhos dos arquivos, nunca os
conteúdos) e já contém o resultado de tudo que foi pedido, processado onde era
trabalho do core (ex.: `dynamicAttributes` aplicados antes de renderizar o
relatório pedido).

### 3.2 O request

`ExecutionRequest` espelha o mapa de opções da CLI (plano §5.2) em campos
tipados. Só há campos **semânticos**; opções de renderização (`--silent`,
`--no-color`) **não entram no request** — vivem apenas no consumidor. O
**conteúdo dos arquivos chega inline** via `files` (fechamento completo de
`include`s): **não** há provedor/callback de leitura nem acesso a disco.

```ts
interface ExecutionInputFile {
  path: string;                  // id/caminho como referenciado nos `include`
                                 //   (relativo ao arquivo-pai, como no Ruby)
  content: string;               // conteúdo integral do arquivo
}

interface ExecutionRequest {
  files: ExecutionInputFile[];   // FECHAMENTO COMPLETO: master + todos os
                                 //   .tjp/.tji que ele referenciar via include.
                                 //   O core NÃO lê disco nem recebe provedor:
                                 //   resolve `include` procurando o `path` nesta
                                 //   lista (ausente ⇒ erro de arquivo não
                                 //   encontrado, como no `tj3`).
  entry?: string;                // `path` do master a parsear (default: files[0].path)
  configContent?: string;        // YAML já lido pelo consumidor (sem FS no core)
  checkSyntax?: boolean;
  listReports?: string;          // id/regex
  report?: string;               // id ou regex (com reportsIsRegex)
  reportsIsRegex?: boolean;
  dynamicAttributes?: string;    // string "-A ..." crua; o core faz o pipeline 18.19
  outputDir?: string;
  noReports?: boolean;
  forceReports?: boolean;
  abortOnWarnings?: boolean;
  warnTsDeltas?: boolean;
  addTrace?: boolean;
  freeze?: { date?: string; byTask?: boolean };
  help?: boolean;                // sem files: responde só a seção help
  version?: boolean;             // sem files: responde só a seção version
  man?: { format: "html" | "text" | "tjp"; keyword?: string; outputDir?: string };
  app?: "ts-send" | "ts-receive" | "ts-summary" | "ss-send" | "ss-receive"
      | "check-ts" | "check-ss"; // apps de sheet (Fase 18/Fase 24)
  appOptions?: SheetAppOptions;  // { from?: string; rawMessage?: string; ... }
}
```

### 3.3 Contrato do envelope

```json
{
  "ok": true,
  "exitCode": 0,
  "options": { "entry": "tutorial.tjp", "files": ["tutorial.tjp", "common.tji"], "outputDir": "out", "checkSyntax": false },
  "messages": [
    { "severity": "warning", "id": "all_scenarios_disabled",
      "text": "...", "file": "tutorial.tjp", "line": 12, "offset": 0 }
  ],
  "results": {
    "reports": {
      "outputDir": "out",
      "reports": [
        { "name": "Tarefas", "stdout": true,
          "formats": [ { "format": "csv", "content": "..." },
                       { "format": "html", "content": "..." } ],
          "errors": [] },
        { "name": "Recursos", "stdout": false,
          "formats": [ { "format": "csv", "content": "..." } ],
          "errors": [] }
      ]
    }
  }
}
```

### 3.4 Regras do envelope

| Campo | Tipo | Descrição |
|---|---|---|
| `ok` | boolean | `false` se houve erro global que impediu o resultado pedido. |
| `exitCode` | `0 \| 1` | **Dado, não ação**: calculado pelo core com a matriz do §5.3 do plano (fiel a `apps/Tj3.rb`); o consumidor chama `exit()`. |
| `options` | object | **Echo** de todos os parâmetros recebidos, normalizados com defaults aplicados (o consumidor não precisa reter estado das opções). Dos arquivos são ecoados **apenas os caminhos** (`entry` + `files[]` como lista de `path`s), **nunca os conteúdos** — o texto entra só pelo request e **não** é devolvido no envelope (reduz tráfego/tamanho do retorno). |
| `messages` | array | Mensagens do `MessageHandler` estruturadas (`severity`, `id`, `text`, `file`, `line`), para o consumidor renderizar com cor/quiet a seu critério. |
| `results` | object | Seções por tipo de resultado. **Só existe a seção correspondente ao que foi pedido** (`check` para `checkSyntax`, `listReports`, `reports`, `freeze`, `sheet`, `man`, `help`, `version`). |

Seções:

| Seção | Conteúdo |
|---|---|
| `results.check` | `{ valid: boolean }` — parse sem agenda (fonte do exit do `--check-syntax`). |
| `results.listReports` | `[{ name, type }]` na ordem de declaração. |
| `results.reports` | objeto com `outputDir` (**presente apenas se `outputDir` foi passado no request**) + `reports[]` com o contrato da v1: `name` (único; duplicata é erro de validação), `stdout` (reflete o modificador na DSL), `formats[]` (`{ format, content }`, conteúdo já renderizado como string, na ordem declarada), `errors[]` por relatório (ex.: filtro inválido, formato não suportado). Relatórios pedidos com `dynamicAttributes` já saem **processados pelo core** (pipeline 18.19 interno). |
| `results.freeze` | `{ fileName, contents }` — o novo conteúdo do master file reescrito; **a gravação é do consumidor** (via escrita injetada/`io.writeText`). |
| `results.sheet` | `{ app, exitCode?, emailText?, attachments?: [{ name, contents }], summaryText?, reportText? }` — apps de sheet (senders devolvem o **texto do email** e anexos como dados; receivers recebem o texto da mensagem por `appOptions.rawMessage`, sem SMTP nem FS). |
| `results.man` | documentação de sintaxe/keywords (`doc-core` da Fase 22) no formato pedido. |
| `results.help` | especificação estruturada das opções (`OptionSpec[]`) — mesma fonte que alimenta o comando Cliffy, para consumidores não-CLI (MCP/editor). |
| `results.version` | `{ name, version }` de `AppConfig`/`metadata.json`. |

### 3.5 O que o `core` **não** faz

- Não grava arquivos nem imprime: nada de `fs`, `process.stdout`, `console` (pureza auditada — §5.2 do plano).
- Não recebe **provedor de arquivo** nem callback de leitura: o conteúdo chega
  pronto em `request.files`; os `include` são resolvidos por *lookup* em
  memória contra essa lista, **nunca** contra disco.
- Não **devolve** os conteúdos dos arquivos no envelope — o eco `options` traz
  apenas os caminhos.
- Não lê argv nem conhece Cliffy: o request chega pronto.
- Não decide o que fazer com `stdout: true`/`false`, com `exitCode`, com `emailText` ou com `freeze.contents`.
- Não sanitiza nomes de arquivo nem define política de saída/renderização.

O `core` apenas **produz o envelope**. Toda decisão de execução é do consumidor.

### 3.6 Transportabilidade do contrato (Web Worker · HTTP · lib) — nota 2026-11-07

O contrato é desenhado para que chamador e core possam estar **fisicamente
separados**. Três futuros suportados, sem mudança de forma:

- **Web Worker (UI Fase 20)**: a UI envia o `request` por `postMessage` e
  recebe o envelope de volta — ambos os lados são **dados puros** (strings,
  números, arrays, objetos simples), structured-cloneáveis, sem funções,
  instâncias de classe ou callbacks. O worker **não precisa de FS nem de
  provedor**: o conteúdo chega inline em `request.files` (v2.1).
- **Cliente–servidor (HTTP/RPC)**: um endpoint recebe o JSON do request,
  aguarda o `execute` (já é `Promise`) e responde com o **mesmo envelope** —
  `exitCode`, `options`, `messages` e seções são **dados**, não ações de
  processo, então nada precisa "executar" no lado do cliente além do despacho.
  O envio assíncrono é nativo (polling/SSE/WebSocket sobre a mesma resposta).
  Os conteúdos não voltam no retorno (v2.1), o que mantém o payload pequeno.
  **Isolamento por chamada** (requisito para concorrência no mesmo processo):
  `MessageHandlerInstance` e `DataCache` são singletons de processo — todo
  `execute` deve **repor o snapshot de mensagens e usar instância
  `TaskJuggler` dedicada por chamada** (como o `tj3`, que roda um processo por
  execução). Servidores concorrentes serializam chamadas por instância ou usam
  uma instância/worker por request.
- **Lib pública**: `execute` e os tipos `ExecutionInputFile`/
  `ExecutionRequest`/`ExecutionResult` são exportados pelo
  `@vanaware/syntaxmesh` (subpath raiz, `mod.ts`) — qualquer código TypeScript
  (Deno, Node, Bun, browser) pode incorporar o motor sem depender de CLI, FS,
  argv ou provedor. O schema do envelope é o **contrato público**: mudanças
  entram por adendo a este arquivo (source of truth), com compatibilidade
  regida pela política de versões da Fase 21.

Leitura do `project` em memória via fachada **depois** do `execute`
(conveniência de resumo da UI/CLI na F24) é uso **in-process** exclusivo:
consumidores separados por Worker/HTTP apoiam-se **somente no envelope**.

---

## 4. Responsabilidades do pacote CLI

O CLI é o **único** componente que conhece sistema de arquivos e terminal. Fluxo:

### 4.1 Algoritmo

```
1. argv → opções; a CLI lê o master + os .tjp/.tji referenciados via
   io.readText e monta request.files (fechamento completo de includes;
   entry = master). --silent/--no-color ficam no renderer (options.ts)
2. await core.execute(request) -> ExecutionResult   (sem provedor: o conteúdo
   já está em request.files; o envelope devolve só os caminhos)
3. Renderizar messages (cores/quiet/silêncio: política do renderer)
4. Despachar sections presentes em results:
   - check/listReports/help/version: imprimir representação adequada
   - reports: aplicar a política de stdout/arquivo (§4.2/§4.3)
   - freeze: escrever contents no fileName (com confirmação como no tj3)
   - sheet: imprimir/emailText, gravar outbox/*.eml, anexos como dados recebidos
   - man: imprimir ou gravar o documento no --output-dir
5. exit(result.exitCode)
```

Em falha global (`ok: false`), o CLI reporta e **não prossegue** com saída
parcial, salvo configuração explícita.

### 4.2 Regras de impressão no terminal (`stdout: true`)

- Imprimir **todos** os formatos do relatório, na ordem declarada.
- Usar delimitador explícito para separar relatórios e formatos, por exemplo:
  ```
  --- Tarefas [csv] ---
  <conteúdo>
  --- Tarefas [html] ---
  <conteúdo>
  --- Recursos [csv] ---
  <conteúdo>
  ```
- Não misturar conteúdo de relatórios diferentes sem delimitador.

### 4.3 Regras de gravação em arquivo (`stdout: false`)

- Nome do arquivo: `{name}.{format}` (ex.: `Tarefas.csv`, `Recursos.html`), com
  a tabela de extensões do plano §5.5 ponto 1 para formatos cujo sufixo difere
  do id (`markdown`→`md`, `iCal`→`ics`, etc.).
- Sanitizar o nome: remover ou substituir caracteres inválidos para o sistema de arquivos.
- Se o arquivo já existir, sobrescrever (comportamento padrão) ou emitir aviso, conforme política definida.
- O diretório de saída é o `outputDir` ecoado na seção `reports` (definido pelo consumidor, nunca pelo `.tjp`).

### 4.4 Erros

- Erros em `reports[].errors` devem ser reportados com clareza.
- Política de abortar vs. continuar deve ser documentada no README do CLI.
- `ok: false` no topo indica falha global; o CLI deve reportar e não prosseguir com a geração parcial, a menos que configurado explicitamente.
- `exitCode` do envelope é a única fonte do código de saída; o CLI só chama `exit()`.

---

## 5. Compatibilidade e testes

### 5.1 Compatibilidade

- Arquivos `.tjp` sem `stdout` devem produzir `stdout: false` no JSON e comportamento idêntico ao anterior no CLI (gravação em arquivo).
- Nenhuma mudança de comportamento para projetos existentes.
- A fachada passo-a-passo (`parse`/`schedule`/`generateReports`) permanece para consumidores que orquestram o pipeline (UI/PWA Fase 20); `execute` é o atalho canônico dos consumidores de linha de comando. Para essa fachada passo-a-passo a leitura por **provedor injetado** permanece; `execute`, porém, **não** usa provedor — recebe `request.files` com o conteúdo pronto e alimenta a resolução de `include` com um *lookup* em memória dessa lista.
- **Consumidores planejados (nota 2026-11-07):** além da CLI (v1), a extensão VS Code da **Fase 22** reaproveita esta mesma API — as camadas daemon/relatórios (*tj3d*/*tj3webd* simulados) chamam `execute` e consomem o envelope, sem fork de API. Se os conceitos de daemon exigirem algo a mais (modelo de projeto persistente no core, load/unload/list-projects, gerar relatório sem re-parse), **esta API incorpora o delta** via adendo a este arquivo (source of truth), propagado ao plano/tarefas da Fase 24 e anotado em `fase-22-vscode-extension.md` §3.2/§3.3.
- **Costuras legadas (nota 2026-11-07):** o `FileStore` injetado do ADR 037 (apps de sheet da F18; `TaskJuggler.fileStore`; `checkTimeSheet`/`checkStatusSheet` por caminho), o `CSVFile.read` do ADR 027, os hooks de escrita do ADR 038 e o `ImageResolver` do ADR 026 foram entregues/planejados sob o conceito de *injeção de leitura de arquivo* — **nenhum deles cruza a fronteira do `execute`**: arquivos entram só como dado (`request.files`/`appOptions`), resultados saem só como dado (seções). As costuras permanecem válidas no caminho passo-a-passo (Fases 19–20); o refatoramento está registrado nas tarefas da F24 (**grupo 5**, 24.2.31–24.2.35) com aditamento dos ADRs correspondentes.
- **English-first (nota 2026-11-07, plano §1.7):** todo o texto **emitido** pelo tool é em inglês por default — `messages`, `help`, `version`, `man`, templates/corpo dos emails de sheet, nomes de seções e flags. O i18n (Fase 10) é capacidade de **entrada**: parsear projetos com keywords pt/es e a diretiva `language` continuam valendo para a regra zero e os goldens F21; nenhuma saída do envelope segue o idioma do arquivo. Expansão multilíngue da saída é adendo futuro. **Parser pt/es é experimental** (mesma data): o `man`/help e os exemplos default da CLI operam em `en`; o caminho pt/es fica exposto apenas como piso de compatibilidade, não como superfície recomendada ao usuário.
- **Extensão única `.smx` (nota 2026-11-07, plano §1.6):** a extensão nativa do SyntaxMesh é `.smx` (substituindo o par `.tjp`/`.tji`); a distinção master/include passa a ser de **papel** (`entry` vs. referenciados por `include`) — exatamente a semântica de `request.files`/`entry` deste adendo v2.1, que nunca dependeu de extensão: o *lookup* de `include` é por **caminho**. As validações de extensão herdadas do Ruby (parser F10, `SHEET_EXTENSION` dos sheets F18) são relaxadas para aceitar `.smx` em tarefa própria (**24.2.36**) — ADAPTAÇÃO à regra zero (ADR 011) — e `.tjp`/`.tji` continuam aceitos por compatibilidade (goldens F21, projetos existentes, anexos `.tji` em trânsito).

### 5.2 Testes obrigatórios

- **Parser**: `stdout` reconhecido na posição correta; erro em posição inválida; duplicata detectada.
- **Core (envelope)**: `execute` retorna eco fiel dos `options` com defaults; só popula a seção pedida; `reports` com `outputDir` presente **somente** quando passado; `messages` estruturadas; `exitCode` conforme matriz §5.3 do plano; `dynamicAttributes` aplicados internamente antes da render. O eco `options` traz **apenas os caminhos** dos arquivos (nunca conteúdos); `include` é resolvido contra `request.files` e um `path` referenciado **ausente** na lista ⇒ erro (não exceção de FS).
- **Integração (entrada por lista)**: um `.tjp` que `include` um `.tji` presente em `request.files` monta o projeto **sem nenhum acesso a disco**; `entry` default = `files[0].path`.
- **Extensão `.smx` (24.2.36)**: master `.smx` parseia; `include` de `.smx` é aceito; `.tjp`/`.tji` continuam aceitos (goldens da regra zero intactos); receiver de sheets reconhece anexo `.tji` legítimo e gera/templates usam `.smx` (aditamento ADR 011 — ADAPTAÇÃO).
- **Transportabilidade (adendo §3.6)**: request e envelope sobrevivem a round-trip `JSON.stringify`/`parse` e a structured-clone (sem funções nem instâncias de classe); duas chamadas `execute` concorrentes no mesmo processo **não vazam** `messages` nem projeto uma para a outra (snapshot/repor por chamada; singleton `MessageHandlerInstance`/`DataCache`); `execute` + tipos disponíveis no export raiz do `mod.ts`.
- **Core (relatórios)**: `renderReports` interno retorna todos os relatórios, ordem preservada, `stdout` refletido, `formats` completos, `errors` por relatório.
- **Core (pureza)**: nenhum acesso a `fs` ou `process` no pacote `core`; nenhum `exit()`/argv no core.
- **CLI**: despacho de seções; `stdout: true` imprime com delimitador; `stdout: false` grava arquivo sanitizado; múltiplos formatos tratados corretamente; erros reportados; `exit(result.exitCode)`.
- **Integração**: `.tjp` com relatórios mistos (`stdout` e não `stdout`) produz saída correta no CLI; chamada de `app` de sheet retorna `sheet` devidamente identificada (email-texto round-trip).

---

## 6. Resumo executivo

- **`stdout` na DSL**: opcional, booleano de intenção, antes das chaves (v1, inalterado).
- **`core.execute(request)`** é o ponto único de entrada: roda o pipeline tj3 e as funções portadas de todos os CLIs do TaskJuggler e devolve o **envelope JSON**.
- **Envelope**: `ok`, `exitCode` (dado), `options` (eco), `messages` (estruturadas), `results` com **seções identificadas** (`check`, `listReports`, `reports`, `freeze`, `sheet`, `man`, `help`, `version`); a seção `reports` traz `outputDir` quando o parâmetro foi passado.
- **O consumidor não precisa reter as opções**: o JSON ecoa tudo e já traz o que era trabalho do core processado (dynamic reports, sheets, freeze como conteúdo).
- **Entrada = lista de arquivos com conteúdo** (`request.files[]` de `{ path, content }`, fechamento completo de `include`s, `entry` opcional): **sem** provedor de arquivo e **sem** acesso a disco; os `include` são resolvidos por *lookup* contra a lista; os conteúdos **não** voltam no envelope (eco só dos caminhos) para poupar tráfego/tamanho.
- **Core é puro**: sem `fs`, sem terminal, sem argv, sem `exit`, sem provedor de arquivo, sem política de saída.
- **Contrato transportável (§3.6)**: request/envelope são dados puros JSON-serializáveis — comportam Web Worker (`postMessage`), servidor HTTP/RPC com `execute` assíncrono (com snapshot/repor de estado por chamada) e incorporação via export público do `@vanaware/syntaxmesh`.
- **CLI é o único que decide e renderiza**: imprime com delimitador, grava `{name}.{ext}` sanitizado, escreve freeze/outbox, sai com `exitCode`.
- **Compatibilidade preservada**: `.tjp` sem `stdout` e fachada passo-a-passo continuam funcionando como antes.

Este adendo pode ser entregue diretamente à IA que desenvolve o SyntaxMesh como especificação de implementação.
