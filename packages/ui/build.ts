/// <reference lib="deno.ns" />
import { ensureDir, copy, walk } from "@std/fs";
import { join } from "@std/path";

const DIST_DIR = "dist";
const BUILD_DIR = "monorepo/server/build";
const SRC_DIR = "src";
const PUBLIC_DIR = "public";

interface BundleResult {
  success: boolean;
  errors?: unknown[];
  warnings?: unknown[];
  outputFiles?: Array<{
    path: string;
    contents: Record<string, number> | Uint8Array | string;
    hash?: string;
  }>;
  code?: string;
  output?: string;
}

interface BundleOptions {
  entrypoints: string[];
  outputDir?: string;
  outputFile?: string;
  platform?: "browser" | "deno" | "neutral";
  format?: "esm" | "iife" | "cjs";
  bundle?: boolean;
  minify?: boolean;
  sourcemap?: boolean | "linked" | "inline";
  write?: boolean;
  jsx?: "automatic" | "react" | "preserve";
  jsxImportSource?: string;
  jsxFactory?: string;
  jsxFragment?: string;
}

async function incrementVersion(skipIncrement: boolean = false): Promise<string> {
  const denoJsoncPath = "deno.jsonc";
  let content = await Deno.readTextFile(denoJsoncPath);
  let currentVersion = "0.0.0";
  
  if (skipIncrement) {
    // 🔥 ARQUITETURA [READ-ONLY]: O hash do cache já faz parte da versão (ex: 0.2.148-msv0okam).
    // Apenas lemos a string atual e repassamos, sem tocar no sistema de arquivos.
    const match = content.match(/"version"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      currentVersion = match[1];
    }
    console.log(`📌 Parâmetro 'noversion' detectado. Mantendo versão e hash de cache intactos: v${currentVersion}`);
    return currentVersion;
  }

  // 📈 Fluxo Normal: Incrementa o Patch e gera novo hash de cache (Cache Buster)
  const buildHash = Date.now().toString(36);

  content = content.replace(/"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)(?:-[a-zA-Z0-9]+)?"/, (_match, major, minor, patch) => {
    const nextPatch = parseInt(patch, 10) + 1;
    currentVersion = `${major}.${minor}.${nextPatch}-${buildHash}`;
    return `"version": "${currentVersion}"`;
  });

  await Deno.writeTextFile(denoJsoncPath, content);
  
  await ensureDir(join(SRC_DIR, "constants"));
  const versionTsContent = `// Arquivo gerado automaticamente pelo build.ts\nexport const APP_VERSION = "${currentVersion}";\n`;
  await Deno.writeTextFile(join(SRC_DIR, "constants", "version.ts"), versionTsContent);
  
  console.log(`📈 Versão incrementada para: v${currentVersion}`);
  return currentVersion;
}

async function clean() {
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch {
    // diretório não existe, ok
  }
  await ensureDir(join(BUILD_DIR,DIST_DIR));
  console.log("📁 Arquivos anteriores excluídos");
}

async function copyStaticAndSyncManifest(appVersion: string) {
  try {
    await copy(PUBLIC_DIR, join(BUILD_DIR,DIST_DIR), { overwrite: true });
    
    const manifestPath = join(BUILD_DIR, DIST_DIR, "manifest.json");
    try {
      const manifestText = await Deno.readTextFile(manifestPath);
      const manifestObj = JSON.parse(manifestText);
      manifestObj.version = appVersion;
      await Deno.writeTextFile(manifestPath, JSON.stringify(manifestObj, null, 2));
      console.log(`📱 Versão v${appVersion} injetada em dist/manifest.json`);
    } catch {
      console.log("⚠️ Não foi possível atualizar a versão dentro do manifest.json");
    }

    console.log("📁 Arquivos estáticos copiados");
  } catch {
    console.log("⚠️ Pasta public não encontrada ou erro na cópia");
  }
}

function contentsToString(contents: Record<string, number> | Uint8Array | string): string {
  if (typeof contents === 'string') return contents;
  if (contents instanceof Uint8Array) return new TextDecoder().decode(contents);
  if (contents && typeof contents === 'object') {
    const bytes: number[] = [];
    const keys = Object.keys(contents);
    const isNumericKeys = keys.every(k => !isNaN(Number(k)));
    if (isNumericKeys && keys.length > 0) {
      const sortedKeys = keys.map(Number).sort((a, b) => a - b);
      for (const key of sortedKeys) {
        const value = (contents as Record<string, number>)[key.toString()];
        if (typeof value === 'number' && value >= 0 && value <= 255) bytes.push(value);
      }
      if (bytes.length > 0) return new TextDecoder().decode(new Uint8Array(bytes));
    }
  }
  return JSON.stringify(contents);
}

function extrairCodigoDoBundle(result: BundleResult): string {
  if (!result.outputFiles || result.outputFiles.length === 0) return '';
  const file = result.outputFiles[0];
  if (!file || !file.contents) return '';
  return contentsToString(file.contents);
}

async function runBundle(name: string, bundleOpts: BundleOptions): Promise<BundleResult> {
  console.log(`🔨 [${name}] Iniciando bundle...`);
  // deno-lint-ignore no-explicit-any
  const result = (await (Deno as any).bundle(bundleOpts)) as BundleResult;
  if (!result.success) {
    console.error(`❌ Erros no bundle ${name}:`, result.errors);
    throw new Error(`Falha ao gerar ${name}`);
  }
  for (const warning of result.warnings || []) {
    console.warn(`⚠️ ${name}:`, warning);
  }
  return result;
}



async function listarAssetsParaCache(): Promise<string[]> {
  const assets: string[] = [];
  const exclude = new Set(['service-worker.js', 'service-worker.tmp.js']);
  
  for await (const entry of walk(join(BUILD_DIR,DIST_DIR), { includeDirs: false })) {
    if (!entry.name.endsWith(".map") && !exclude.has(entry.name)) {
      let webPath = entry.path.replace(join(BUILD_DIR,DIST_DIR), "").replace(/\\/g, "/");
      
      if (webPath.startsWith('/')) {
        webPath = '.' + webPath;
      } else {
        webPath = './' + webPath;
      }
      
      assets.push(webPath);
    }
  }
  return assets;
}

async function build() {
  // 🔥 LÊ ARGUMENTOS DA CLI: Identifica se "noversion" foi passado
  const args = Deno.args.map(a => a.toLowerCase().replace(/^-+/, ''));
  const skipVersionIncrement = args.includes('noversion');

  console.log("\n🚀 Iniciando build Loco ...\n");
  const start = performance.now();

  const appVersion = await incrementVersion(skipVersionIncrement);
  await clean();
  await copyStaticAndSyncManifest(appVersion);

  console.log("📦 Compilando página HTML ...");
  await runBundle("HTML", {
    entrypoints: [
      join(SRC_DIR, "index.html")
    ],
    outputDir: join(BUILD_DIR,DIST_DIR),
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: false,
    write: true,
    jsx: "automatic",
    jsxImportSource: "preact",
    jsxFactory: "h",
    jsxFragment: "Fragment",
  });

  console.log("📦 Compilando Web Worker Dedicado (P2P)...");
  await runBundle("WebWorker", {
    entrypoints: [join(SRC_DIR, "worker", "opfs.worker.ts")],
    outputDir: join(BUILD_DIR, DIST_DIR),
    platform: "browser",
    format: "iife", // O formato IIFE clássico garante compatibilidade total com importScripts() em 100% dos navegadores
    bundle: true,
    minify: false,
    write: true,
  });
  
  console.log("📦 Compilando Service Worker em memória...");
  const swResult = await runBundle("ServiceWorker", {
    entrypoints: [join(SRC_DIR, "service-worker.ts")],
    platform: "browser",
    format: "iife",
    bundle: true,
    minify: false,
    write: false,
  });

  let swCode = extrairCodigoDoBundle(swResult);
  if (swCode.length < 100) throw new Error("Não foi possível extrair o código do Service Worker");

  const assets = await listarAssetsParaCache();
  const versionHash = `v${appVersion}`;

  swCode = swCode
    .replace(/__GENERATED_ASSETS__/g, JSON.stringify(assets)); 

  await Deno.writeTextFile(join(BUILD_DIR, DIST_DIR, "service-worker.js"), swCode);

  console.log(`✨ Service Worker gerado com sucesso! (Cache ID: ${versionHash})`);
  console.log(`    📦 ${assets.length} assets em cache`);
  console.log(`    📄 Tamanho: ${(swCode.length / 1024).toFixed(2)} KB`);

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`\n✨ Build completo em ${elapsed}ms → ${BUILD_DIR}/\n`);
}

await build();