/// <reference lib="deno.ns" />
import { serveDir } from "@std/http/file-server";
import workerHandler from "./worker.ts";

const env = Deno.env.toObject();

Deno.serve({ port: Number(env?.PORT || 8000) }, async (req) => {
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      p.catch(console.error);
    },
    passThroughOnException: () => {},
  };

  // 1. Tenta processar a requisição através do workerHandler (APIs e Proxy Push)
  const workerResponse = await workerHandler.fetch(req, env, ctx);

  // 2. Se o worker processou com sucesso ou retornou erro de API (ex: 400, 403, 500), retorna o resultado dele
  if (workerResponse.status !== 404) {
    return workerResponse;
  }

  // 3. Se o worker retornou 404 (Endpoint não encontrado), significa que não é uma API.
  // Deixamos o serveDir processar para entregar o arquivo estático correspondente (HTML, JS, CSS, Ícones).
  //
  // 🔥 CORREÇÃO: CWD do main.ts é monorepo/server/, então o build está em ./build/dist
  // (e NÃO em ../build/dist, que apontaria para monorepo/build/dist — caminho inexistente)
  try {
    const staticResponse = await serveDir(req, {
      fsRoot: "./build/dist",
      showDirListing: false,
      quiet: true,
    });
    
    // Se o arquivo estático foi encontrado e servido com sucesso, retorna-o
    if (staticResponse.status !== 404) {
      return staticResponse;
    }
  } catch (err) {
    // 🔥 DIAGNÓSTICO: Log útil para identificar se o build ainda não rodou ou o caminho mudou
    console.warn(
      `[STATIC] Falha ao servir arquivo estático. Build ainda não foi executado?`,
      err instanceof Error ? err.message : err
    );
  }

  // 4. Se nem a API nem o disco possuíam o recurso, retorna o 404 limpo do worker
  return workerResponse;
});