/**
 * 17.7.3 — `SVGSupport`: conversão dos atributos para SVG
 * (`Painter/SVGSupport.rb`).
 *
 * No Ruby é um `module` misturado em `Element` e `Group`, que lê `@values` e
 * devolve um hash pronto para `XMLElement.new(type, values)`. Como os dois
 * consumidores têm o campo `values`, o port expõe uma função livre
 * (`valuesToSVG(values)`) chamada por ambos.
 *
 * Regras do oráculo Ruby (2026-11-04):
 * - Underscores viram travessões: `stroke_width` → `stroke-width`.
 * - Só `font_size` ganha unidade `pt` (a comparação é feita com a chave
 *   original, antes do `gsub`). `font-size` de outras formas não existe.
 * - Valores passam por `v.to_s`, então `Color` (que responde `to_s`) entra
 *   como `#rrggbb` e `2.5` como `"2.5"`.
 * - Ordem das chaves é a de inserção do hash de origem — não há ordenação.
 * - Nota TS: o Ruby distingue `Integer` de `Float` (`1` vs `1.0`); aqui ambos
 *   são `number` e serializam como `String(1)` = `"1"`. Registrado nos
 *   goldens da 17.16 quando aparecer caso real.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/SVGSupport.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.3)
 */

/** Valor de um atributo do Painter: número, string ou objeto com `to_s()`. */
export type SVGValue = string | number | { to_s(): string };

/** Mapa de atributos do Painter (chaves em `snake_case`, como no Ruby). */
export type SVGValues = Record<string, SVGValue>;

/** Converte os atributos para a sintaxe SVG (Ruby `SVGSupport#valuesToSVG`). */
export function valuesToSVG(values: SVGValues,): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value,] of Object.entries(values,)) {
    const unit = key === "font_size" ? "pt" : "";
    out[key.replace(/_/g, "-",)] = svgString(value,) + unit;
  }
  return out;
}

/** Ruby `v.to_s` para os valores aceitos pelo Painter. */
function svgString(value: SVGValue,): string {
  return typeof value === "object" ? value.to_s() : String(value,);
}
