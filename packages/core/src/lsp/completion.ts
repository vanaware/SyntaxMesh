/**
 * `completion.ts` — keyword and name completion (22.1.11 = I 7.7).
 *
 * Bridge to the doc-core, not a reimplementation: the keyword universe is
 * the union of `SyntaxCore.categories()` (the Kate/Vim lists), indexed once
 * in a `TernarySearchTree` for prefix lookup — the same structure
 * `syntaxmesh man` uses. Property names complete as `Property`, the other
 * keywords as `Keyword`; the tasks/resources/accounts declared in the
 * document complete as `Reference` (relative id, the form used in
 * `depends`/`allocate`).
 *
 * v1 is English-only: `locale` is accepted for the post-Fase 21 addendum
 * and ignored (plan §5).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getCompletions)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4 / I 7.7
 */
import {
  SyntaxCore,
  syntaxReference,
  TernarySearchTree,
} from "../docgen/mod.ts";
import type { AnalysisResult, } from "./analyze.ts";
import type { Locale, } from "./locale.ts";
import { tokenAt, } from "./semantic-tokens.ts";
import type { CompletionItem, Position, } from "./types.ts";

/** `CompletionItemKind.Property` — property keywords (task, resource, …). */
const KIND_PROPERTY = 10;
/** `CompletionItemKind.Keyword` — the remaining language keywords. */
const KIND_KEYWORD = 14;
/** `CompletionItemKind.Reference` — user-defined names. */
const KIND_REFERENCE = 18;

/** Memoized keyword index (one SyntaxCore/TST construction per process). */
let keywordCache: {
  all: string[];
  tree: TernarySearchTree<string>;
  properties: ReadonlySet<string>;
} | null = null;

/** Builds (once) the sorted keyword union, its TST and the property set. */
function keywordIndex(): NonNullable<typeof keywordCache> {
  if (keywordCache !== null) return keywordCache;
  const core = new SyntaxCore(syntaxReference(null, true,),);
  const categories = core.categories();
  const all = [
    ...new Set([
      ...categories.keywords,
      ...categories.builtin,
      ...categories.types,
    ],),
  ].sort();
  const tree = new TernarySearchTree<string>();
  tree.insertList(all,);
  keywordCache = {
    all,
    tree,
    properties: new Set(categories.builtin,),
  };
  return keywordCache;
}

/** Normalizes the TST result (`T | T[] | null`) to an array. */
function matchesOf(result: string | string[] | null,): string[] {
  if (result === null) return [];
  return Array.isArray(result,) ? result : [result,];
}

/**
 * Completion items at a cursor position: keywords matching the prefix under
 * the cursor (all of them when the prefix is empty) plus the declared
 * task/resource/account names. Inside strings, numbers, dates or comments
 * nothing is offered.
 *
 * @param analysis result of {@link analyzeDocument}.
 * @param position 0-based cursor position.
 * @param locale accepted for the multilingual addendum; ignored in v1.
 * @returns the suggestions, keywords first (sorted), then declared names.
 */
export function getCompletions(
  analysis: AnalysisResult,
  position: Position,
  locale: Locale = "en",
): CompletionItem[] {
  void locale;
  let token = tokenAt(analysis.text, position,);
  if (token === null && position.character > 0) {
    // The cursor usually sits right **after** the last typed character
    // (exclusive end of the token): look one character back.
    const behind = tokenAt(analysis.text, {
      line: position.line,
      character: position.character - 1,
    },);
    if (
      behind !== null &&
      behind.line === position.line &&
      behind.character + behind.length === position.character
    ) token = behind;
  }
  if (
    token !== null && token.type !== "identifier" && token.type !== "keyword"
  ) return [];
  let prefix = "";
  if (token !== null) {
    const lineText = analysis.text.split("\n",)[token.line] ?? "";
    const full = lineText.slice(
      token.character,
      token.character + token.length,
    );
    prefix = full.slice(0, position.character - token.character,);
  }
  const { all, tree, properties, } = keywordIndex();
  const matches = prefix === "" ? all : matchesOf(tree.find(prefix, true,),);
  const items: CompletionItem[] = matches.map((label,) => ({
    label,
    kind: properties.has(label,) ? KIND_PROPERTY : KIND_KEYWORD,
    detail: "SyntaxMesh keyword",
  }));
  const project = analysis.project;
  if (project !== null) {
    const sets: Array<[typeof project.tasks, string,]> = [
      [project.tasks, "task",],
      [project.resources, "resource",],
      [project.accounts, "account",],
    ];
    for (const [set, kind,] of sets) {
      for (const node of set.toArray()) {
        if (prefix !== "" && !node.subId.startsWith(prefix,)) continue;
        items.push({
          label: node.subId,
          kind: KIND_REFERENCE,
          detail: `${kind} name`,
        },);
      }
    }
  }
  return items;
}
