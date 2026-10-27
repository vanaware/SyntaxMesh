/**
 * Picture (extensão SyntaxMesh — Fase 10 Complemento C3.3).
 *
 * Imagem anexada a uma `journalentry` ou `status`. Não existe no TaskJuggler
 * original como entidade própria: é uma estrutura mínima que o parser preenche
 * e que os relatórios (Fase 14) e o storage de imagens (Fase 19) consomem.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (C3.3.5)
 */

/** Alinhamento válido de uma imagem no relatório. */
export type PictureAlign = "left" | "center" | "right";

/** Imagem anexada a uma entrada de journal/status. */
export class Picture {
  readonly path: string;
  caption: string | null = null;
  align: PictureAlign | null = null;
  width: number | null = null;
  alt: string | null = null;

  constructor(path: string,) {
    this.path = path;
  }
}
