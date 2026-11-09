import { AppConfig, } from "./app-config.ts";
import { APP_VERSION as VERSION, } from "./version.ts";

/**
 * Inicializa AppConfig com valores do SyntaxMesh.
 *
 * A **versão** vem de `version.ts` (publicada como `VERSION` pelo barril do
 * pacote) — antes era literal `"0.0.0"` aqui, o que fazia `--version`, banner e
 * atributo `version` do projeto divergirem do manifesto bumpado por
 * `scripts/tag-version.ts`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Tj3Config.rb
 */
export function initTj3Config(): void {
  AppConfig.version = VERSION;
  AppConfig.packageName = "syntaxmesh";
  AppConfig.softwareName = "SyntaxMesh";
  AppConfig.packageInfo = "SyntaxMesh - TypeScript port of TaskJuggler";
  AppConfig.appName = "syntaxmesh";
  AppConfig.authors = "SyntaxMesh Contributors";
  AppConfig.copyright = "Copyright (c) 2026 SyntaxMesh Contributors";
  AppConfig.contact = "syntaxmesh@example.com";
  AppConfig.license = "GPL-3.0-or-later";
}
