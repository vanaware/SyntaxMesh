/**
 * Headless TextMate tokenizer (F21², 26.30.1).
 *
 * Tokenizes the **generated** SyntaxMesh grammar (`generateGrammar`) over real
 * text without VS Code: `vscode-textmate` drives the rules and
 * `vscode-oniguruma` (WASM) provides the regex engine. Test-only — these deps
 * never enter a bundle (the editor's highlight runtime is VS Code's own).
 *
 * The WASM is loaded once per process from the npm package's `release/onig.wasm`
 * (resolved relative to the package entry), and the registry is cached so the
 * grammar is compiled a single time across the corpus suites.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.30)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6/§11
 */
// Both packages ship CommonJS: Deno's npm interop exposes the API on the
// default export only (named value imports fail at runtime), so values come
// from the default and types from type-only named imports.
import oniguruma from "vscode-oniguruma";
import textmate from "vscode-textmate";
import type {
  IRawGrammar,
  IToken,
  Registry as RegistryType,
} from "vscode-textmate";
import { generateGrammar, } from "../../src/grammar/textmate.ts";

/** The root scope of the generated grammar. */
export const SCOPE_NAME = "source.syntaxmesh";

/** One token with its text slice and TextMate scopes (line-relative). */
export interface ScopedToken {
  text: string;
  scopes: string[];
  startIndex: number;
  endIndex: number;
}

/** Cached registry so the WASM + grammar compile once per process. */
let registryPromise: Promise<RegistryType> | null = null;

/** Builds the registry: oniguruma WASM engine + the generated grammar. */
async function buildRegistry(): Promise<RegistryType> {
  // `import.meta.resolve` points at the package entry (release/main.js); the
  // WASM is its sibling. Reading it needs --allow-read (the test task has it).
  const wasmUrl = new URL(
    "onig.wasm",
    import.meta.resolve("vscode-oniguruma",),
  );
  const wasmBytes = await Deno.readFile(wasmUrl,);
  const onigLib = oniguruma.loadWASM(wasmBytes,).then(() => ({
    createOnigScanner: (patterns: string[],) =>
      new oniguruma.OnigScanner(patterns,),
    createOnigString: (str: string,) => new oniguruma.OnigString(str,),
  }));
  return new textmate.Registry({
    onigLib,
    loadGrammar: (scopeName,) =>
      Promise.resolve(
        scopeName === SCOPE_NAME
          ? generateGrammar() as unknown as IRawGrammar
          : null,
      ),
  },);
}

/** Resolves the shared registry (loads the WASM on first use). */
function registry(): Promise<RegistryType> {
  registryPromise ??= buildRegistry();
  return registryPromise;
}

/**
 * Tokenizes text into per-line scoped tokens, carrying the TextMate state
 * stack across lines (so block comments/strings span correctly).
 *
 * @param text full document text.
 * @returns one array of tokens per line (the trailing empty line included).
 */
export async function tokenize(text: string,): Promise<ScopedToken[][]> {
  const grammar = await (await registry()).loadGrammar(SCOPE_NAME,);
  if (grammar === null) throw new Error("grammar failed to load",);
  let state = textmate.INITIAL;
  const lines: ScopedToken[][] = [];
  for (const line of text.split("\n",)) {
    const result = grammar.tokenizeLine(line, state,);
    state = result.ruleStack;
    lines.push(result.tokens.map((token: IToken,) => ({
      text: line.slice(token.startIndex, token.endIndex,),
      scopes: token.scopes,
      startIndex: token.startIndex,
      endIndex: token.endIndex,
    })),);
  }
  return lines;
}

/** Flattens every token of a text (convenience for scope assertions). */
export async function tokenizeFlat(text: string,): Promise<ScopedToken[]> {
  return (await tokenize(text,)).flat();
}

/**
 * Compact tokenization snapshot (text + scopes per line, indices dropped) for
 * golden tests. Stable across runs: the grammar and the state stack are
 * deterministic, so the same text always yields the same projection.
 *
 * @param text full document text.
 * @returns one array of `{ text, scopes }` per line.
 */
export async function tokenizeSnapshot(
  text: string,
): Promise<{ text: string; scopes: string[] }[][]> {
  const lines = await tokenize(text,);
  return lines.map((line,) =>
    line.map(({ text, scopes, },) => ({ text, scopes, }))
  );
}

/** True when any scope of the token ends with the given suffix. */
export function hasScope(token: ScopedToken, suffix: string,): boolean {
  return token.scopes.some((scope,) => scope.endsWith(suffix,));
}
