/**
 * Build-time application metadata.
 *
 * One source of truth for identity strings: `version` comes straight from
 * `version.ts`, so the CLI banner, the `--version` output and the `version`
 * attribute of a {@link Project} can never disagree. The package barrel
 * (`mod.ts`) republishes the same constant as `VERSION`.
 *
 * This module imports the leaf module and **not** the barrel: `app-config.ts`
 * is a dependency of almost everything (including
 * `sheets/sheet-handler-base.ts`), and reaching for `mod.ts` from here closes
 * class-initialisation cycles (`Cannot access 'SheetHandlerBase' before
 * initialization`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/AppConfig.rb
 */
import { APP_VERSION as VERSION, } from "./version.ts";

/**
 * Static registry of the package identity, resolvable before any project is
 * loaded.
 */
export class AppConfig {
  /** Semantic version of the running build (same value as `VERSION`). */
  static version: string = VERSION;
  /** Bare package name as published to JSR. */
  static packageName: string = "@vanaware/syntaxmesh";
  /** Product name shown in banners and generated documents. */
  static softwareName: string = "SyntaxMesh";
  /** One-line product description. */
  static packageInfo: string = "SyntaxMesh - Project management, simplified";
  /** Short identifier used in file names and configuration keys. */
  static appName: string = "syntaxmesh";
  /** Credit line for generated documents. */
  static authors: string = "Vanaware Team";
  /** Copyright notice for generated documents. */
  static copyright: string = "Copyright (c) 2026 Vanaware";
  /** Public contact address for generated documents. */
  static contact: string = "syntaxmesh@vanaware.com";
  /** SPDX identifier of the license the output may be redistributed under. */
  static license: string = "GPL-2.0";

  /**
   * Installation data directories for `baseDir`.
   *
   * Kept for TaskJuggler API parity; this port resolves data files through the
   * injected store, so it reports no directories.
   *
   * @param baseDir Root the platform would derive directories from; ignored.
   * @returns Always an empty array.
   */
  static dataDirs(baseDir: string,): string[] {
    return [];
  }

  /**
   * Ordered data search path for `baseDir`.
   *
   * Kept for TaskJuggler API parity; this port resolves data files through the
   * injected store, so it reports no directories.
   *
   * @param baseDir Root the platform would derive directories from; ignored.
   * @returns Always an empty array.
   */
  static dataSearchDirs(baseDir: string,): string[] {
    return [];
  }

  /**
   * Every data directory that contains `fileName`.
   *
   * Kept for TaskJuggler API parity; this port resolves data files through the
   * injected store, so it never reports a hit.
   *
   * @param fileName Name to look for; ignored.
   * @returns Always an empty array.
   */
  static dataFiles(fileName: string,): string[] {
    return [];
  }

  /**
   * First data directory that contains `fileName`.
   *
   * Kept for TaskJuggler API parity; this port resolves data files through the
   * injected store, so it never reports a hit.
   *
   * @param fileName Name to look for; ignored.
   * @returns Always `null`.
   */
  static dataFile(fileName: string,): string | null {
    return null;
  }
}
