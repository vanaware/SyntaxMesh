import { AppConfig } from "./app-config.ts";

/**
 * Inicializa AppConfig com valores do TaskJuggler.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Tj3Config.rb
 */
export function initTj3Config(): void {
  AppConfig.version = "0.0.0";
  AppConfig.packageName = "syntaxmesh";
  AppConfig.softwareName = "SyntaxMesh";
  AppConfig.packageInfo = "SyntaxMesh - TypeScript port of TaskJuggler";
  AppConfig.appName = "syntaxmesh";
  AppConfig.authors = "SyntaxMesh Contributors";
  AppConfig.copyright = "Copyright (c) 2026 SyntaxMesh Contributors";
  AppConfig.contact = "syntaxmesh@example.com";
  AppConfig.license = "GPL-3.0-or-later";
}