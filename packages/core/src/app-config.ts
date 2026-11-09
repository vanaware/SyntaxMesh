/**
 * AppConfig — metadados da aplicação.
 *
 * A versão vem de `version.ts` (fonte única): `--version` da CLI, o banner e o
 * atributo `version` de `Project` não podem divergir. O barril do pacote
 * (`mod.ts`) publica a mesma constante como `VERSION`.
 *
 * Importa o módulo folha, **não** o barril: `app-config.ts` é dependência de
 * quase tudo (inclusive `sheets/sheet-handler-base.ts`), e puxar `mod.ts` daqui
 * fecha ciclos de classes (`Cannot access 'SheetHandlerBase' before
 * initialization`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/AppConfig.rb
 */
import { APP_VERSION as VERSION, } from "./version.ts";

export class AppConfig {
  static version: string = VERSION;
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
