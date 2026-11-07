# Especificação: API de Execução do SyntaxMesh (envelope JSON) e parâmetro `stdout`

> **v2 (2026-11-07):** a API deixou de ser apenas de relatórios. Ela é agora o
> **ponto único de entrada** para todas as chamadas que qualquer consumidor
> (CLI, MCP, editor, testes) faz ao core — cobrindo o pipeline do `tj3` e as
> funções portadas de todos os apps de linha de comando do TaskJuggler
> (`Tj3Man`, `tj3ts_*`, `tj3ss_*`, `freeze`). O contrato de relatórios da v1
> (`stdout`, `formats[]`, `errors[]`) permanece válido, agora como **uma seção**
> do envelope.

## 1. Objetivo

Definir a **API de execução do core** (`execute`): o consumidor monta um
*request* com todas as opções já traduzidas (sem orquestrar o pipeline), e o
core devolve um **envelope JSON** com (a) o eco dos parâmetros recebidos, (b)
uma **seção identificada por tipo de resultado** (`check`, `listReports`,
`reports`, `freeze`, `sheet`, `man`, `help`, `version`) e (c) mensagens e
`exitCode` como dados. A decisão efetiva de *como* executar — imprimir, gravar
arquivo, colorir, sair do processo — é responsabilidade exclusiva do
consumidor (na v1, o pacote CLI), mantendo o `core` puro e agnóstico de
ambiente.

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

Ele executa internamente todo o fluxo correspondente ao `tj3` (leitura via
provedor injetado → parse → gates → schedule → relatórios com atributos
dinâmicos → operações pontuais como freeze/list/man/sheets) e devolve o
envelope completo. O consumidor **não orquestra o pipeline** e **não precisa
reexaminar as opções que passou**: o envelope traz o eco dos parâmetros e já
contém o resultado de tudo que foi pedido, processado onde era trabalho do core
(ex.: `dynamicAttributes` aplicados antes de renderizar o relatório pedido).

### 3.2 O request

`ExecutionRequest` espelha o mapa de opções da CLI (plano §5.2) em campos
tipados. Só há campos **semânticos**; opções de renderização (`--silent`,
`--no-color`) **não entram no request** — vivem apenas no consumidor.

```ts
interface ExecutionRequest {
  file?: string;                 // master .tjp (lido via provedor injetado)
  content?: string;              // conteúdo já carregado (parseContent)
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
  help?: boolean;                // sem file: responde só a seção help
  version?: boolean;             // sem file: responde só a seção version
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
  "options": { "file": "tutorial.tjp", "outputDir": "out", "checkSyntax": false },
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
| `options` | object | **Echo** de todos os parâmetros recebidos, normalizados com defaults aplicados (o consumidor não precisa reter estado das opções). |
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
- Não lê argv nem conhece Cliffy: o request chega pronto.
- Não decide o que fazer com `stdout: true`/`false`, com `exitCode`, com `emailText` ou com `freeze.contents`.
- Não sanitiza nomes de arquivo nem define política de saída/renderização.

O `core` apenas **produz o envelope**. Toda decisão de execução é do consumidor.

---

## 4. Responsabilidades do pacote CLI

O CLI é o **único** componente que conhece sistema de arquivos e terminal. Fluxo:

### 4.1 Algoritmo

```
1. argv → ExecutionRequest (options.ts; --silent/--no-color ficam no renderer)
2. await core.execute(request) -> ExecutionResult   (provedor de conteúdo = io.readText)
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
- A fachada passo-a-passo (`parse`/`schedule`/`generateReports`) permanece para consumidores que orquestram o pipeline (UI/PWA Fase 20); `execute` é o atalho canônico dos consumidores de linha de comando.

### 5.2 Testes obrigatórios

- **Parser**: `stdout` reconhecido na posição correta; erro em posição inválida; duplicata detectada.
- **Core (envelope)**: `execute` retorna eco fiel dos `options` com defaults; só popula a seção pedida; `reports` com `outputDir` presente **somente** quando passado; `messages` estruturadas; `exitCode` conforme matriz §5.3 do plano; `dynamicAttributes` aplicados internamente antes da render.
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
- **Core é puro**: sem `fs`, sem terminal, sem argv, sem `exit`, sem política de saída.
- **CLI é o único que decide e renderiza**: imprime com delimitador, grava `{name}.{ext}` sanitizado, escreve freeze/outbox, sai com `exitCode`.
- **Compatibilidade preservada**: `.tjp` sem `stdout` e fachada passo-a-passo continuam funcionando como antes.

Este adendo pode ser entregue diretamente à IA que desenvolve o SyntaxMesh como especificação de implementação.
