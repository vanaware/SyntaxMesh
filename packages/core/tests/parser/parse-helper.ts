/**
 * Helper de parse para os testes das regras TjpSyntaxRules (10.11–10.14).
 *
 * Abre um buffer de texto como arquivo-mestre, roda `parse('project')` e
 * devolve o resultado junto com os registros do MessageHandler — sem deixar
 * mensagens entre testes (reset no início de cada).
 */
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";

export interface ParseOutcome {
  parser: ProjectFileParser;
  /** Resultado da regra 'project': Project, false (erro) ou null (vazio). */
  result: unknown;
  /** Exceção não-Tj capturada, se o parse lançou. */
  threw: Error | null;
  /** IDs das mensagens registradas durante o parse. */
  messageIds: string[];
  /** Mensagens completas (id + texto) para diagnóstico. */
  messages: Array<{ id: string; text: string }>;
}

/** Executa o parse de `text` e coleta resultado + mensagens. */
export function parseProject(text: string,): ParseOutcome {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  const parser = new ProjectFileParser();
  parser.open(text, true, true,);
  let result: unknown = null;
  let threw: Error | null = null;
  try {
    result = parser.parse("project",);
  } catch (e) {
    threw = e as Error;
  }
  const messages = MessageHandlerInstance.instance.messages.map((m,) => ({
    id: m.id,
    text: (m as unknown as { message?: string }).message ?? "",
  }));
  return {
    parser,
    result,
    threw,
    messageIds: messages.map((m,) => m.id),
    messages,
  };
}

/** Cabeçalho de projeto mínimo reutilizável nos testes de blocos. */
export const PROJECT_HEADER =
  'project prj "Test" "1.0" 2026-01-01 - 2026-12-31\n';
