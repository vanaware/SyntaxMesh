/**
 * `bundle-node.ts` — empacota a CLI para Node/Bun (24.6.3).
 *
 * O bundle é produzido por `deno bundle --platform=deno`, o **único** bundler
 * do projeto que resolve o import map (`jsr:@cliffy/command`, `npm:` do core)
 * sem `node_modules`. O resultado roda em Node/Bun porque a CLI só usa
 * `node:` builtins e `console` (ADR 034 §3) — a sonda de runtime fica em
 * `src/io.ts`.
 *
 * Artefatos gerados em `dist/` (ignorado pelo git):
 *  - `cli.js` com shebang `#!/usr/bin/env node` (ESM);
 *  - `package.json` com `{"type":"module"}` para `node dist/cli.js` valer ESM.
 *
 * Uso: `deno task build:node` (pacote) — requer `--allow-read --allow-write
 * --allow-run`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.6.3)
 */
import { join, } from "node:path";

/** Entrypoint da CLI. */
const ENTRY = new URL("../src/cli.ts", import.meta.url,).pathname;
/** Diretório de saída dos artefatos de distribuição. */
const DIST = new URL("../dist/", import.meta.url,).pathname;
/** Shebang para execução direta (`./cli.js`). */
const SHEBANG = "#!/usr/bin/env node\n";

/** Executa `deno bundle` e devolve o arquivo temporário gerado. */
async function bundle(): Promise<string> {
  const tmp = await Deno.makeTempFile({
    prefix: "syntaxmesh-cli-",
    suffix: ".mjs",
  },);
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--platform=deno",
      "--no-check",
      "--minify",
      "--output",
      tmp,
      ENTRY,
    ],
    stdout: "piped",
    stderr: "piped",
  },);
  const output = await command.output();
  if (!output.success) {
    const err = new TextDecoder().decode(output.stderr,);
    throw new Error(`deno bundle failed:\n${err}`,);
  }
  const warned = new TextDecoder().decode(output.stderr,);
  for (const line of warned.split("\n",)) {
    if (line.trim() === "") continue;
    console.error(line,);
  }
  return tmp;
}

/** Escreve `dist/cli.js` + `dist/package.json`. */
async function emit(bundlePath: string,): Promise<void> {
  await Deno.mkdir(DIST, { recursive: true, },);
  const code = await Deno.readTextFile(bundlePath,);
  const target = join(DIST, "cli.js",);
  await Deno.writeTextFile(target, SHEBANG + code,);
  await Deno.chmod(target, 0o755,);
  await Deno.writeTextFile(
    join(DIST, "package.json",),
    `${JSON.stringify({ type: "module", private: true, }, null, 2,)}\n`,
  );
  const kb = Math.round((SHEBANG.length + code.length) / 1024,);
  console.log(`dist/cli.js — ${kb} kB (ESM, shebang node)`,);
}

if (import.meta.main) {
  const tmp = await bundle();
  try {
    await emit(tmp,);
  } finally {
    await Deno.remove(tmp,);
  }
}
