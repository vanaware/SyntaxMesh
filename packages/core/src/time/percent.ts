/**
 * Marca de valor percentual produzida pelo parser (`work 50%`).
 *
 * O Ruby distingue `Integer` (slots diretos) de `Float` (fração 0.0–1.0) com
 * `is_a?(Integer)` em `TimeSheetRecord#work=` (TimeSheets.rb l.53-60). Em
 * TypeScript todo número é `number`, então o parser marca explicitamente o
 * caso percentual: sem isso `work 100%` (fração `1.0`) seria indistinguível de
 * `work 1h` (1 slot) e o total do período sairia errado.
 *
 * `valueOf()` devolve a fração, de modo que usos aritméticos acidentais
 * continuam corretos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheets.rb
 */
export class Percent {
  constructor(readonly fraction: number,) {}

  valueOf(): number {
    return this.fraction;
  }

  toString(): string {
    return String(this.fraction,);
  }
}
