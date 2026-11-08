/**
 * Execução dos apps de sheet sobre **dados** (Fase 24, 24.2.32).
 *
 * Os cinco apps (`ts/ss` × `send`/`receive`/`summary`) continuam a usar
 * `SheetHandlerBase` e a interface `FileStore` (ADR 037) — **rebaixada, não
 * revogada**: quem chama passo a passo (PWA/F19) injeta o store persistente.
 * Na fronteira do `execute` nada de disco entra: este módulo semeia um
 * {@link MemoryFileStore} com os arquivos do request, roda o app e devolve o
 * resultado como **dado** (`files`, `emails`, `attachments`, `log`).
 *
 * Assim `requireFileStore` deixa de ser uma exigência do chamador: o store
 * sempre existe, mas é efêmero e o consumidor decide o que persistir (a CLI
 * grava pelo `io.ts`, 24.10).
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.5
 */

import {
  MemoryFileStore,
  type MemoryStoreFile,
} from "../interfaces/memory-file-store.ts";
import type { Project, } from "../model/project.ts";
import type { SheetAppBase, } from "./apps/app-base.ts";
import type { EmailMessage, } from "./email-message.ts";
import type { SheetLogEntry, } from "./sheet-handler-base.ts";

/** Arquivo de entrada/saída do caminho de dados (`request.files`). */
export type SheetDataFile = MemoryStoreFile;

/** Anexo devolvido por um sender/receiver — já materializado em texto. */
export interface SheetDataAttachment {
  /** Nome do anexo (`dev_2026-05-18.tji`). */
  name: string;
  /** Conteúdo UTF-8 do anexo. */
  contents: string;
}

/**
 * Entrada do app no caminho de dados.
 *
 * `files` é o fechamento de leituras: o que o app abriria do disco entra aqui
 * (templates, `resources.json`, assinaturas, `all.tji`). `dirs` cria pastas
 * vazias que o fluxo espera encontrar (por exemplo a pasta do período).
 */
export interface SheetAppData {
  /** Arquivos visíveis ao app (semeiam o `MemoryFileStore`). */
  files?: readonly SheetDataFile[];
  /** Diretórios que devem existir antes do app rodar. */
  dirs?: readonly string[];
  /** Texto RFC 822 recebido (receivers) — dado, não arquivo. */
  rawEmail?: string | null;
}

/** Saída do app no caminho de dados — tudo é valor, nada é efeito. */
export interface SheetAppDataResult {
  /** `0` sucesso · `1` falha (mesma matriz de `SheetAppBase#run`). */
  exitCode: number;
  /** Mensagens montadas por `sendEmail`, na ordem de emissão. */
  emails: EmailMessage[];
  /** Anexos das mensagens, materializados em `{name, contents}`. */
  attachments: SheetDataAttachment[];
  /** Store final (artefatos gerados pelo app), ordenado por caminho. */
  files: SheetDataFile[];
  /** Log em memória do handler (`SheetHandlerBase#logEntries`). */
  log: SheetLogEntry[];
}

/**
 * Roda um app de sheet com entrada e saída de dados.
 *
 * O `MessageHandler` continua sendo a via de diagnóstico (o `execute` o
 * serializa e o transforma em `messages`); aqui nenhum texto é impresso.
 */
export async function runSheetAppData(
  app: SheetAppBase,
  project: Project,
  data: SheetAppData = {},
): Promise<SheetAppDataResult> {
  const store = new MemoryFileStore([...(data.files ?? []),],);
  for (const dir of data.dirs ?? []) {
    await store.mkdir(dir,);
  }

  const exitCode = await app.run({
    project,
    fileStore: store,
    rawEmail: data.rawEmail ?? null,
  },);

  const handler = app.handler;
  const emails = [...handler.sentMessages,];
  return {
    exitCode,
    emails,
    attachments: collectAttachments(emails,),
    files: store.toFiles(),
    log: [...handler.logEntries,],
  };
}

/** Extrai os anexos já materializados das mensagens (sem ler store). */
function collectAttachments(emails: EmailMessage[],): SheetDataAttachment[] {
  const attachments: SheetDataAttachment[] = [];
  for (const email of emails) {
    if (email.attachmentName === null || email.attachment === null) continue;
    attachments.push({
      name: email.attachmentName,
      contents: email.attachment,
    },);
  }
  return attachments;
}
