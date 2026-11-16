/**
 * Regenerates the tokenization golden fixture (F21², 26.30.3).
 *
 * Test-only: it drives the headless TextMate tokenizer (`vscode-textmate` +
 * `vscode-oniguruma`, npm deps), so it lives under `tests/` and never enters a
 * bundle. The pure grammar goldens stay in `scripts/generate-snapshots.ts`;
 * this one is separate to keep that task free of npm dependencies.
 *
 * Run after an intentional grammar/tokenizer change:
 *   deno run --allow-read --allow-write --allow-env tests/grammar/generate-tokenization.ts
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.30.3)
 */
import { tokenizeSnapshot, } from "./tokenizer.ts";

/** Repo root (this script lives in `tests/grammar/`). */
const ROOT = new URL("../../../../", import.meta.url,);
/** Representative EN fixture: the first tutorial MWE. */
const SOURCE = new URL("docs/Learning/mwe001/tutorial.tjp", ROOT,);
/** Committed golden, beside the other grammar fixtures. */
const OUT = new URL("./fixtures/tokenization.golden.json", import.meta.url,);

const text = await Deno.readTextFile(SOURCE,);
const snapshot = await tokenizeSnapshot(text,);
await Deno.writeTextFile(OUT, JSON.stringify(snapshot, null, 2,) + "\n",);
console.log(`wrote tests/grammar/fixtures/tokenization.golden.json`,);
console.log(`  ${snapshot.length} lines, ${snapshot.flat().length} tokens`,);
