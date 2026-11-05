/**
 * `XMLElementLike` — interface mínima de elemento XML/HTML (Fase 12).
 *
 * Nascimento: `src/richtext/xml-like.ts` (Fase 12.1), quando o RichText
 * precisou retornar uma **árvore** de elementos em vez de string e o
 * `XMLElement` real ainda não existia. Na **Fase 17.12** (ADR 038) a
 * implementação mínima `XMLElement` é apagada e `XMLElement` passa a
 * cumprir o contrato — a interface então **mora aqui**, no bloco XML, e o
 * RichText passa a importar daqui.
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.12.1)
 */

/** Interface de nó XML/HTML usada pelo RichText e pelo Gantt. */
export interface XMLElementLike {
  /** Nome da tag (ex.: `div`). `null` = fragmento (sem tag própria). */
  readonly tag: string | null;
  /** Atributos chave→valor. */
  readonly attrs: Record<string, string>;
  /** Filhos: nós XML (texto já é `XMLElement` — `XMLText`). */
  readonly children: Array<XMLElementLike | string>;
  /** Anexa um filho (nó ou texto). */
  append(child: XMLElementLike | string,): void;
  /** Serializa para HTML sem indentação (alias de `to_s(0)`). */
  toHTML(): string;
}
