/**
 * AlertLevelDefinitions mínimo (bring-forward 14C.0.7 — dona: Fase 16).
 *
 * Porta as partes de `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb`
 * consumidas hoje: a palette default do TJ (verde → amarelo → vermelho, em
 * severidade ascendente) e a resolução id/nome → índice numérico. O nível de
 * alerta de uma `JournalEntry` é o **índice** na lista do projeto (Ruby
 * `rule_alertLevel` devolve `indexById`), exatamente como `Journal.rb:69` e os
 * filtros `alerts_*` dos relatórios esperam.
 *
 * A configuração pela diretiva `alertlevels` continua no parser (project.ts);
 * a Fase 16 (adendo 16.21) herda este módulo e estende com a classe completa
 * (add/clear/modified/to_tjp sobre o `Project['alertLevels']`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.0.7)
 */

/** Nível de alerta: id único, nome único e cor HTML (#RGB/#RRGGBB). */
export interface AlertLevelDefinition {
  id: string;
  name: string;
  color: string;
}

/** Defaults do Ruby (`AlertLevelDefinitions#initialize`), severidade ascendente. */
export const DEFAULT_ALERT_LEVELS: AlertLevelDefinition[] = [
  { id: "green", name: "Green", color: "#008000", },
  { id: "yellow", name: "Yellow", color: "#BEA800", },
  { id: "red", name: "Red", color: "#C00000", },
];

/** Cópia dos defaults (o `Project` guarda sua própria lista mutável). */
export function defaultAlertLevels(): AlertLevelDefinition[] {
  return DEFAULT_ALERT_LEVELS.map((l,) => ({ ...l, }));
}

/** Índice do nível por id (`indexById` do Ruby); `null` se desconhecido. */
export function alertLevelIndexById(
  levels: AlertLevelDefinition[],
  id: string,
): number | null {
  const i = levels.findIndex((l,) => l.id === id);
  return i < 0 ? null : i;
}

/** Índice do nível por nome (`indexByName` do Ruby); `null` se desconhecido. */
export function alertLevelIndexByName(
  levels: AlertLevelDefinition[],
  name: string,
): number | null {
  const i = levels.findIndex((l,) => l.name === name);
  return i < 0 ? null : i;
}

/** Lista de ids para mensagens de erro (`Must be one of ...`, Ruby l.203). */
export function alertLevelIds(levels: AlertLevelDefinition[],): string[] {
  return levels.map((l,) => l.id);
}
