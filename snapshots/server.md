> **AI INSTRUCTION:** 
> O texto abaixo contém os arquivos de configuração e execução do SERVIDOR @workerdb/server e CI/CD.
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project SyntaxMesh [v0.0.2-mtvrt8od] - Mode: SERVER

Automatically generated at: 2026-10-28T21:19:03.403Z

---

## File: `packages/server/.env.example`

```properties
# .env.example
PORT=3000

```

---

## File: `packages/server/deno.jsonc`

```json
{
  "name": "@syntaxmesh/server",
  "compilerOptions": {
    "lib": [
      "dom",
      "dom.iterable",
      "dom.asynciterable",
      "esnext",
      "deno.ns",
      "deno.unstable"
    ],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  },
  "imports": {
    "@negrel/webpush": "jsr:@negrel/webpush@^0.5.0",
    "@std/assert": "jsr:@std/assert",
    "@std/fs": "jsr:@std/fs",
    "@std/http": "jsr:@std/http",
    "@std/path": "jsr:@std/path",
    "@cloudflare/workers-types": "npm:@cloudflare/workers-types",
    "wrangler": "npm:wrangler"
  },
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read --unstable-bundle tests/",
    "check": "deno check --unstable-bundle src/**/*.ts src/**/*.tsx tests/**/*.ts",
    "tests": "deno task check && deno task test",
    "start": "deno run --allow-read --allow-write --allow-env --allow-net --env-file ./src/main.ts",
    "dev": "deno run --allow-read --allow-write --allow-env --allow-net --env-file --watch ./src/main.ts",
    "clean": "deno clean && rm -rf ./build && mkdir -p ./build/dist",
    "deploy": "deno task init && ./deploy.sh"
  },
  "exports": "./src/main.ts",
  "exclude": ["./build/"]
}

```

---

## File: `packages/server/src/main.ts`

```ts
/// <reference lib="deno.ns" />

import { serveDir, } from "@std/http/file-server";
import { fromFileUrl, } from "@std/path";

const rawPort = Deno.env.get("PORT",);
const port = rawPort ? Number(rawPort,) : 3000;

const fsRoot = (() => {
  const distUrl = fromFileUrl(new URL("../build/dist", import.meta.url,),);
  try {
    Deno.statSync(distUrl,);
    return distUrl;
  } catch {
    try {
      Deno.statSync("./build/dist",);
      return "./build/dist";
    } catch {
      return "./packages/server/build/dist";
    }
  }
})();

Deno.serve({ port, hostname: "0.0.0.0", }, async (req,) => {
  try {
    const url = new URL(req.url,);
    console.debug(`[REQ] ${req.method} ${url.pathname}`,);

    const staticResponse = await serveDir(req, {
      fsRoot,
      showDirListing: false,
      quiet: true,
    },);

    staticResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    staticResponse.headers.set("Pragma", "no-cache",);
    staticResponse.headers.set("Expires", "0",);

    // Permitir escopo global para Service Worker
    if (url.pathname === "/sw.js" || url.pathname.endsWith("/sw.js",)) {
      staticResponse.headers.set("Service-Worker-Allowed", "/",);
    }
    return staticResponse;
  } catch (err) {
    console.warn(
      `[STATIC] Falha ao servir arquivo estático. Verifique se Build foi executado?`,
      err instanceof Error ? err.message : err,
    );

    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", },
    },);
  }
},);

```

---

