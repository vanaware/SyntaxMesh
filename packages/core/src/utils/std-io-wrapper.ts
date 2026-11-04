/**
 * `stdIoWrapper` — captura o que o bloco escreve em stdout/stderr.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb`. No Ruby o
 * wrapper troca `$stdout`/`$stderr` por `StringIO` e devolve
 * `Results(returnValue, stdOut, stdErr)`; qualquer erro dentro do bloco vale
 * como `returnValue = 1` (convenção dos apps `tj3*`).
 *
 * No browser (Category B — ver `cheat-sheet-ruby-ts.md` §12):
 * • `console.log`/`console.error` são globais compartilhados — a troca vale
 *   para o processo inteiro, não por thread (não há threads);
 * • `stdIn` não existe em `console`, então é aceito e ignorado;
 * • erros capturados são **qualquer** `Error`, não só `RuntimeError`.
 *
 * Consumidores previstos: Fase 18 (`TimeSheetSummary.getResourceJournal`) e
 * Fase 24 (apps de sheet).
 *
 * @see docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.11)
 */

/** Resultado da execução (Ruby `StdIoWrapper::Results`). */
export interface Results<T,> {
  /** Valor devolvido por `fn` (ou `1` quando `fn` lançou). */
  returnValue: T | 1;
  /** Tudo que foi escrito em `console.log`. */
  stdOut: string;
  /** Tudo que foi escrito em `console.error`. */
  stdErr: string;
}

/** Converte um argumento de `console.*` para texto (como o `puts` do Ruby). */
function toText(value: unknown,): string {
  if (typeof value === "string") return value;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return value.name || "<function>";
  try {
    const json = JSON.stringify(value,);
    return json === undefined ? String(value,) : json;
  } catch {
    return String(value,);
  }
}

/** Junta os argumentos de uma chamada de `console` numa linha. */
function formatArgs(args: unknown[],): string {
  return args.map(toText,).join(" ",) + "\n";
}

/**
 * Executa `fn` capturando `console.log`/`console.error`.
 *
 * `stdIn` é aceito por compatibilidade com a assinatura Ruby e ignorado (o
 * browser não tem stdin). A saída capturada **não** é ecoada no console real,
 * como no Ruby (o `StringIO` engole a saída).
 */
export function stdIoWrapper<T,>(
  stdIn: string | null,
  fn: () => T,
): Results<T> {
  void stdIn;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: unknown[]) => {
    stdout.push(formatArgs(args,),);
  };
  console.error = (...args: unknown[]) => {
    stderr.push(formatArgs(args,),);
  };

  let returnValue: T | 1;
  try {
    returnValue = fn();
  } catch {
    // Ruby: `rescue RuntimeError` → 1 ("blocks return 0 on success, 1 on errors").
    returnValue = 1;
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    returnValue,
    stdOut: stdout.join("",),
    stdErr: stderr.join("",),
  };
}
