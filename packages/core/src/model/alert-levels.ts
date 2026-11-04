/**
 * AlertLevelDefinition + AlertLevelDefinitions.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb`. A
 * paleta default é a do TJ (verde → amarelo → vermelho, em severidade
 * ascendente) e o nível de alerta de uma `JournalEntry` é o **índice** na
 * lista do projeto (Ruby `rule_alertLevel` devolve `indexById`), exatamente
 * como `Journal.rb` e os filtros `alerts_*` dos relatórios esperam.
 *
 * A configuração pela diretiva `alertlevels` fica no parser
 * (`parser/rules/project.ts`), que valida unicidade e reporta erro de
 * sintaxe com `SourceFileInfo`; esta classe é o modelo (add/clear/modified/
 * to_tjp) que o `Project` guarda em `project['alertLevels']`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import { TjError, } from "./errors.ts";

/**
 * Um nível de alerta: id único, nome único e cor HTML (#RGB/#RRGGBB).
 *
 * Ruby: `class AlertLevelDefinition < Struct.new(:id, :name, :color)` com
 * `to_s` próprio.
 */
export class AlertLevelDefinition {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly color: string,
  ) {}

  /** Representação para `AlertLevelDefinitions#to_tjp` (Ruby l.23-25). */
  to_s(): string {
    return `${this.id} '${this.name}' '${this.color}'`;
  }

  /** Alias idiomático de {@link to_s} (`join`/template string). */
  toString(): string {
    return this.to_s();
  }
}

/** Defaults do Ruby (`AlertLevelDefinitions#initialize`), severidade ascendente. */
export const DEFAULT_ALERT_LEVELS: AlertLevelDefinition[] = [
  new AlertLevelDefinition("green", "Green", "#008000",),
  new AlertLevelDefinition("yellow", "Yellow", "#BEA800",),
  new AlertLevelDefinition("red", "Red", "#C00000",),
];

/**
 * Lista ordenada de níveis de alerta (Ruby `AlertLevelDefinitions`).
 *
 * Nasce com os três defaults; `modified` indica se a diretiva `alertlevels`
 * já substituiu a paleta padrão.
 */
export class AlertLevelDefinitions {
  private levels: AlertLevelDefinition[] = [];
  private _modified = false;

  constructor() {
    // Ruby l.34-43: adiciona os defaults e reseta o flag `modified`.
    for (const level of DEFAULT_ALERT_LEVELS) {
      this.add(new AlertLevelDefinition(level.id, level.name, level.color,),);
    }
    this._modified = false;
  }

  /** Remove todos os níveis e marca a lista como modificada (Ruby l.46). */
  clear(): void {
    this.levels = [];
    this._modified = true;
  }

  /**
   * Adiciona um nível; id **e** nome precisam ser únicos (Ruby l.52-60).
   *
   * Ruby lança `ArgumentError`; aqui `TjError` para o parser tratar como erro
   * recuperável de diretiva.
   */
  add(level: AlertLevelDefinition,): void {
    if (!(level instanceof AlertLevelDefinition)) {
      throw new TjError("AlertLevelDefinition expected",);
    }
    // Ruby: `if indexById(level.id) || indexByName(level.name)` — o índice 0 é
    // truthy em Ruby (nil é o "não achei"); por isso a comparação é `!== null`.
    if (
      this.indexById(level.id,) !== null ||
      this.indexByName(level.name,) !== null
    ) {
      throw new TjError("ID and name must be unique",);
    }
    this.levels.push(level,);
    this._modified = true;
  }

  /** `true` quando a lista não é mais a default (Ruby `modified?`). */
  get modified(): boolean {
    return this._modified;
  }

  /** Índice do nível com `id`; `null` se desconhecido (Ruby `indexById`). */
  indexById(id: string,): number | null {
    const i = this.levels.findIndex((l,) => l.id === id);
    return i < 0 ? null : i;
  }

  /** Índice do nível com `name`; `null` se desconhecido. */
  indexByName(name: string,): number | null {
    const i = this.levels.findIndex((l,) => l.name === name);
    return i < 0 ? null : i;
  }

  /** Índice do nível com `color`; `null` se desconhecido. */
  indexByColor(color: string,): number | null {
    const i = this.levels.findIndex((l,) => l.color === color);
    return i < 0 ? null : i;
  }

  /** Nível no índice `index`; `null` quando fora de faixa (Ruby `[]`). */
  get(index: number,): AlertLevelDefinition | null {
    return this.levels[index] ?? null;
  }

  /** Mapeia os níveis (Ruby `map`). */
  map<T,>(fn: (level: AlertLevelDefinition, index: number,) => T,): T[] {
    return this.levels.map(fn,);
  }

  /**
   * Definição em sintaxe TJP (Ruby l.98-100):
   * `alertlevels green 'Green' '#008000',
   * yellow 'Yellow' '#BEA800',
   * red 'Red' '#C00000'`.
   */
  to_tjp(): string {
    return `alertlevels ${this.levels.join(",\n",)}`;
  }

  /** Cópia rasa da lista interna (sem expor o array mutável). */
  toArray(): AlertLevelDefinition[] {
    return this.levels.slice();
  }

  /** Número de níveis definidos. */
  get length(): number {
    return this.levels.length;
  }

  /** Iterador sobre os níveis (ordem de severidade ascendente). */
  [Symbol.iterator](): IterableIterator<AlertLevelDefinition> {
    return this.levels[Symbol.iterator]();
  }
}

/** Cópia dos defaults (o `Project` guarda sua própria lista mutável). */
export function defaultAlertLevels(): AlertLevelDefinition[] {
  return DEFAULT_ALERT_LEVELS.map((l,) =>
    new AlertLevelDefinition(l.id, l.name, l.color,)
  );
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
