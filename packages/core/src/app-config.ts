/**
 * AppConfig — metadados da aplicação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AppConfig.rb
 */
export class AppConfig {
  static version: string = "0.0.0";
  static packageName: string = "@vanaware/syntaxmesh";
  static softwareName: string = "SyntaxMesh";
  static packageInfo: string = "SyntaxMesh - Project management, simplified";
  static appName: string = "syntaxmesh";
  static authors: string = "Vanaware Team";
  static copyright: string = "Copyright (c) 2026 Vanaware";
  static contact: string = "syntaxmesh@vanaware.com";
  static license: string = "GPL-2.0";

  static dataDirs(baseDir: string,): string[] {
    return [];
  }

  static dataSearchDirs(baseDir: string,): string[] {
    return [];
  }

  static dataFiles(fileName: string,): string[] {
    return [];
  }

  static dataFile(fileName: string,): string | null {
    return null;
  }
}
