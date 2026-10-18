/**
 * AppConfig — metadados da aplicação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AppConfig.rb
 */
export class AppConfig {
  static version: string = "0.0.0";
  static packageName: string = "@syntaxmesh/core";
  static softwareName: string = "TaskJuggler 3";
  static packageInfo: string = "TaskJuggler 3 - TypeScript port of TaskJuggler";
  static appName: string = "tj3";
  static authors: string = "TaskJuggler Contributors";
  static copyright: string = "Copyright (c) 2026 SyntaxMesh Contributors";
  static contact: string = "syntaxmesh@example.com";
  static license: string = "GPL-3.0-or-later";

  static dataDirs(baseDir: string): string[] {
    return [];
  }

  static dataSearchDirs(baseDir: string): string[] {
    return [];
  }

  static dataFiles(fileName: string): string[] {
    return [];
  }

  static dataFile(fileName: string): string | null {
    return null;
  }
}