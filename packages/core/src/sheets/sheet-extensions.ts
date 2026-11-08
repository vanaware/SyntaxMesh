/**
 * Extensões dos arquivos de folha (time/status sheets) — fonte única.
 *
 * Decisão 2026-11-07 (plano §1.6, tarefa 24.2.36): o SyntaxMesh **grava**
 * `.smx` — templates enviados pelo sender, folhas arquivadas pelo receiver e
 * arquivos de inclusão (`all.smx`). A forma do TaskJuggler (`.tji`/`all.tji`)
 * continua **reconhecida na leitura**, porque anexos de folha ficam em
 * trânsito em caixas de email entre versões.
 *
 * O módulo é neutro de propósito: sender, receiver e summary importam daqui,
 * sem arrastar o pipeline inteiro de um para dentro do outro.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md (§1.6, tarefa 24.2.36)
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md (aditamento)
 */
import { baseName, } from "./email-message.ts";

/** Extensão nativa dos arquivos de folha. */
export const SHEET_EXTENSION = ".smx";

/** Extensão legada (TaskJuggler) — aceita na leitura, nunca gerada. */
export const LEGACY_SHEET_EXTENSION = ".tji";

/** Extensões de folha aceitas na leitura: a nativa e a legada. */
export const SHEET_EXTENSIONS = [
  SHEET_EXTENSION,
  LEGACY_SHEET_EXTENSION,
] as const;

/** Nome do arquivo de inclusão gerado em cada pasta de folhas. */
export const INCLUSION_FILE = "all.smx";

/** Nome legado do arquivo de inclusão (pastas geradas por versões antigas). */
export const LEGACY_INCLUSION_FILE = "all.tji";

/** `true` quando o nome é uma folha (`.smx` ou o legado `.tji`). */
export function isSheetFileName(name: string,): boolean {
  return SHEET_EXTENSIONS.some((ext,) => name.endsWith(ext,));
}

/** `true` quando o nome é o arquivo de inclusão, nativo ou legado. */
export function isInclusionFileName(name: string,): boolean {
  const base = baseName(name,);
  return base === INCLUSION_FILE || base === LEGACY_INCLUSION_FILE;
}
