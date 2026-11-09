/**
 * Contrato da fronteira de execução (Fase 24 — ADR 034, adendo v2.1 §3.2/§3.3).
 *
 * Tudo aqui é **dado puro**: strings, números, booleanos, arrays e objetos
 * simples — structured-cloneáveis e JSON-serializáveis, sem funções,
 * instâncias de classe ou callbacks. Esse é o requisito que permite o mesmo
 * contrato atravessar `postMessage` (Web Worker da Fase 20), HTTP/RPC
 * (cliente–servidor) e o uso como biblioteca (adendo §3.6).
 *
 * O conteúdo dos arquivos entra **inline** em `files` (fechamento completo de
 * `include`s) e **nunca volta** no envelope: o eco `options` traz apenas os
 * caminhos.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3
 */
import type { MessageType, } from "../message.ts";
import type { ReportsJson, } from "../reports/reports-json.ts";

/** Um arquivo do projeto já lido pelo consumidor. */
export interface ExecutionInputFile {
  /**
   * Caminho/id como referenciado nos `include` (relativo ao arquivo-pai, como
   * no Ruby). O core **não** normaliza contra disco: só compara formas
   * canônicas dentro da própria lista.
   */
  path: string;
  /** Conteúdo integral do arquivo. */
  content: string;
}

/** `--freeze` / `--freeze-by-task`. */
export interface ExecutionFreezeRequest {
  /** Data de corte (`--freezedate`); ausente = agora, no core. */
  date?: string;
  /** Agrupar bookings por tarefa em vez de recurso. */
  byTask?: boolean;
}

/** `syntaxmesh man` — documentação de sintaxe (doc-core da Fase 22). */
export interface ExecutionManRequest {
  /**
   * Formato de saída.
   *
   * - `text` — documentação de terminal (default);
   * - `html` — manual completo (ou página de uma keyword) em `files`;
   * - `smx` — recorte de fonte `.smx` colável (exemplo anotado).
   */
  format: "html" | "text" | "smx";
  /** Keywords pedidas; vazio/ausente = documento completo. */
  keywords?: string[];
  /**
   * Colore a saída textual com ANSI.
   *
   * Vem do renderer (a CLI decide por `--no-color`/TTY), nunca do disco: é
   * dado booleano como qualquer outro do request.
   */
  color?: boolean;
  /** Omite keywords `deprecated`/`removed` do apêndice. */
  ignoreOld?: boolean;
}

/** Apps de sheet empacotados pela CLI (Fase 18 + Fase 24). */
export type SheetAppName =
  | "ts-send"
  | "ts-receive"
  | "ts-summary"
  | "ss-send"
  | "ss-receive"
  | "check-ts"
  | "check-ss";

/**
 * Opções dos apps de sheet — subconjunto **de dados** de `SheetAppOptions`.
 *
 * `now` (relógio injetável) fica de fora por contrato: função não atravessa a
 * fronteira do envelope (adendo §3.6). Quem precisa de data determinística
 * chama o app diretamente, in-process.
 *
 * As flags de cada app (`resources`, `force`, `recipients`, …) entram aqui na
 * forma da 18.18; quais delas a CLI expõe é decisão de 24.10.
 */
export interface ExecutionSheetAppOptions {
  workingDir?: string | null;
  dryRun?: boolean;
  config?: Record<string, unknown> | null;
  endDate?: string | number | null;
  /** Remetente (`-f/--from`). */
  from?: string | null;
  /** Mensagem crua recebida (`ts-receive`/`ss-receive`) — texto, não arquivo. */
  rawMessage?: string | null;
  /**
   * Texto da folha para `check-ts`/`check-ss` (24.2.33).
   *
   * Entra como **dado**: a checagem chama `checkTimeSheetContent` /
   * `checkStatusSheetContent` e nunca toca `FileStore` nem disco.
   */
  sheetContent?: string | null;
  /** Nome usado nas mensagens e em `inputFiles` da checagem de folha. */
  sheetFile?: string | null;
  /**
   * Fechamento de leitura do app (24.10): o que o app abriria do disco
   * (templates, `resources.json`, assinaturas, folhas) vem pronto aqui.
   *
   * O consumidor (CLI) lê a árvore do diretório de trabalho e entrega como
   * dado; o core nunca abre arquivo.
   */
  files?: ExecutionInputFile[];
  /** Diretórios que precisam existir antes do app rodar (pastas do período). */
  dirs?: string[];
  /** `-r/--resource <ID>` (repetível) — senders/summary. */
  resources?: string[];
  /** `-f/--force` — reenvia template já existente. */
  force?: boolean;
  /** `-i/--interval <DURATION>` — `ss send`. */
  intervalDuration?: string | null;
  /** `--hideresource <EXPR>` — `ss send`. */
  hideResource?: string | null;
  /** `--sheet <EMAIL>` — destinatários das folhas individuais (`ts summary`). */
  sheetRecipients?: string[];
  /** `--digest <EMAIL>` — destinatários do resumo (`ts summary`). */
  digestRecipients?: string[];
}

/**
 * Eco de `appOptions` (adendo §3.4): o fechamento de leitura sai como
 * **caminhos**, nunca como conteúdo — o envelope não devolve arquivo.
 */
export interface ExecutionSheetAppOptionsEcho
  extends Omit<ExecutionSheetAppOptions, "files"> {
  /** Caminhos semeados no app (sem os conteúdos). */
  files?: string[];
}

/** Pedido de execução — espelha o mapa de flags v1 (plano §5.2). */
export interface ExecutionRequest {
  /**
   * Fechamento completo: master + todo `.tjp`/`.tji` referenciado por
   * `include`. Ausente/vazio ⇒ erro `tj3_tjp_file_missing` (como no `tj3`).
   */
  files?: ExecutionInputFile[];
  /** `path` do master a parsear (default: `files[0].path`). */
  entry?: string;
  /** YAML de configuração já lido pelo consumidor (sem FS no core). */
  configContent?: string;
  /** `--check-syntax`: só parseia, sem agendar (exit 0 se o parse passar). */
  checkSyntax?: boolean;
  /** `--list-reports <RE>`: id ou expressão regular. */
  listReports?: string;
  /** `--list-reports` interpretado como regex (default: `true`). */
  listReportsIsRegex?: boolean;
  /** `--report <R>` / `--reports <RE>`: id ou regex do relatório. */
  report?: string;
  /** `report` é expressão regular. */
  reportsIsRegex?: boolean;
  /** `--report -A "<attrs>"`: snippet cru; o core aplica o pipeline 18.19. */
  dynamicAttributes?: string;
  /** `--output-dir <DIR>`: ecoado na seção `reports` quando presente. */
  outputDir?: string;
  /** `--no-reports`: agenda e para (sem seção `reports`). */
  noReports?: boolean;
  /** `--force-reports`: dispensa o gate de erros do pipeline. */
  forceReports?: boolean;
  /** `--abort-on-warnings`: warning passa a contar como erro. */
  abortOnWarnings?: boolean;
  /** `--warn-ts-deltas`. */
  warnTsDeltas?: boolean;
  /** `--add-trace`: habilita trace reports. */
  addTrace?: boolean;
  /** `--freeze` / `--freeze-by-task`. */
  freeze?: ExecutionFreezeRequest;
  /** `--help`: sem `files`, responde só a seção `help`. */
  help?: boolean;
  /** `--version`: sem `files`, responde só a seção `version`. */
  version?: boolean;
  /** `wz man` (seção `man`). */
  man?: ExecutionManRequest;
  /** App de sheet a executar (seção `sheet`). */
  app?: SheetAppName;
  /** Opções do app de sheet. */
  appOptions?: ExecutionSheetAppOptions;
}

/** Especificação de uma opção de execução (fonte única: seção `help` + CLI). */
export interface OptionSpec {
  /** Nome longo, sem `--` (`report`). */
  name: string;
  /** Nome curto, sem `-` (`R`); `null` quando só existe a forma longa. */
  short: string | null;
  /** Tipo do valor esperado. */
  type: "boolean" | "string" | "number" | "string[]";
  /** Nome do argumento para a ajuda (`<id>`, `<attrs>`), se houver. */
  argument: string | null;
  /** Descrição em inglês (English-first — plano §1.7). */
  description: string;
  /** Flag adiada conscientemente (âncora registrada no plano §5.2). */
  deferred?: string;
}

/** Mensagem estruturada do `MessageHandler` (adendo §3.3). */
export interface ExecutionMessage {
  severity: MessageType;
  id: string;
  text: string;
  /** Arquivo de origem, quando a mensagem tem `SourceFileInfo`. */
  file: string | null;
  /** Linha de origem, quando conhecida. */
  line: number | null;
}

/**
 * Eco do request com defaults aplicados (adendo §3.4).
 *
 * Dos arquivos saem **apenas os caminhos** — `entry` + `files[]` como lista de
 * `path`s. O texto nunca é devolvido.
 */
export interface ExecutionOptionsEcho {
  entry: string;
  files: string[];
  configContent: string | null;
  checkSyntax: boolean;
  listReports: string | null;
  listReportsIsRegex: boolean;
  report: string | null;
  reportsIsRegex: boolean;
  dynamicAttributes: string | null;
  outputDir: string | null;
  noReports: boolean;
  forceReports: boolean;
  abortOnWarnings: boolean;
  warnTsDeltas: boolean;
  addTrace: boolean;
  freeze: ExecutionFreezeRequest | null;
  help: boolean;
  version: boolean;
  man: ExecutionManRequest | null;
  app: SheetAppName | null;
  appOptions: ExecutionSheetAppOptionsEcho | null;
}

/** `results.listReports[]`. */
export interface ListReportsEntry {
  /** Id do relatório na DSL. */
  name: string;
  /** `typeSpec` (`taskreport`, `resourcereport`, `export`, …). */
  type: string;
}

/**
 * Um arquivo produzido pelo freeze (24.9.4).
 *
 * O `tj3 --freeze` gera **dois** artefatos: o include de header com o novo
 * `now` e o export dos bookings. Ambos saem como dado; gravar é do consumidor.
 */
export interface FreezeFile {
  /** Nome lógico do arquivo (derivado do master, como no Ruby). */
  fileName: string;
  /** Conteúdo integral a gravar. */
  contents: string;
}

/**
 * `results.freeze` — artefatos do freeze; a escrita é do consumidor.
 *
 * O Ruby reescreve dois arquivos ao lado do master (`-header.tji` e
 * `-bookings.tji`); o envelope devolve os dois para que a CLI os grave sem
 * reabrir o pipeline.
 */
export interface FreezeSection {
  /** Artefatos na ordem de escrita (header primeiro). */
  files: FreezeFile[];
}

/**
 * Uma mensagem produzida por um app de sheet (24.10).
 *
 * `text` é o RFC 822 completo (mesma forma que o receiver consome): o
 * consumidor imprime, grava `outbox/*.eml` ou entrega ao cliente de email.
 * Nunca há transporte SMTP (ADR 036).
 */
export interface SheetEmail {
  to: string;
  subject: string;
  text: string;
}

/** `results.sheet` — apps de sheet como **dados** (sem SMTP, sem FS). */
export interface SheetSection {
  app: SheetAppName;
  exitCode?: number;
  /** Primeira mensagem (`emails[0].text`) — atalho para app de 1 email. */
  emailText?: string;
  /** Todas as mensagens geradas, na ordem de emissão. */
  emails?: SheetEmail[];
  attachments?: Array<{ name: string; contents: string }>;
  summaryText?: string;
  reportText?: string;
  /**
   * Arquivos que o app **criou ou alterou** no store efêmero (24.10).
   *
   * É o delta contra a semente (`appOptions.files`): o consumidor grava só o
   * que nasceu de fato, sem reescrever as entradas que só foram lidas.
   */
  files?: Array<{ name: string; contents: string }>;
}

/** `results.man` — documentação de sintaxe no formato pedido. */
export interface ManSection {
  format: "html" | "text" | "smx";
  /** Keywords resolvidas (vazio = documento completo). */
  keywords: string[];
  /** Conteúdo renderizado (`text`/`smx`); vazio no formato `html`. */
  content: string;
  /**
   * Arquivos do manual, relativos ao `--output-dir` (só no formato `html`).
   *
   * O core devolve `Record<nome, conteúdo>` (22.1b.5); gravar é da CLI.
   */
  files: Array<{ name: string; contents: string }>;
}

/** Seções de resultado: **só** as pedidas aparecem (adendo §3.4). */
export interface ExecutionResults {
  check?: { valid: boolean };
  listReports?: ListReportsEntry[];
  reports?: ReportsJson;
  freeze?: FreezeSection;
  sheet?: SheetSection;
  man?: ManSection;
  help?: OptionSpec[];
  version?: { name: string; version: string };
}

/** Envelope devolvido por `execute` (contrato público). */
export interface ExecutionResult {
  /** `false` quando um erro impediu o resultado pedido. */
  ok: boolean;
  /** `0` sucesso · `1` erro (matriz do plano §5.3). **Dado**, não ação. */
  exitCode: number;
  options: ExecutionOptionsEcho;
  messages: ExecutionMessage[];
  results: ExecutionResults;
}
