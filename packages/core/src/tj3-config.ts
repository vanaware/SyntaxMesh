import { AppConfig, } from "./app-config.ts";
import { APP_VERSION as VERSION, } from "./version.ts";

/**
 * Initializes AppConfig with the SyntaxMesh values.
 *
 * The **version** comes from `version.ts` (published as `VERSION` by the
 * package barrel) — it used to be the literal `"0.0.0"` here, which made
 * `--version`, the banner and the project's `version` attribute diverge from
 * the manifest bumped by `scripts/tag-version.ts`.
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
