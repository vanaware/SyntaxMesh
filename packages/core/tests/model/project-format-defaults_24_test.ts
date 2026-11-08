/**
 * Fase 24 (24.7) — formatos padrão do projeto no mapa de atributos.
 *
 * O `@data` do `Project` Ruby é semeado no construtor (`Project.rb` l.70-118)
 * com os formatos default:
 *
 * ```ruby
 * 'numberFormat'    => RealFormat.new([ '-', '', '', '.', 1 ]),
 * 'currencyFormat'  => RealFormat.new([ '-', '', '', ',', 2 ]),
 * 'shortTimeFormat' => "%H:%M",
 * 'timeFormat'      => "%Y-%m-%d",
 * ```
 *
 * O port só semeava `dailyworkinghours`/`yearlyworkingdays`/identidade, então
 * `report.get('numberFormat')` (herdado do projeto) vinha `null` e as células
 * numéricas caíam no fallback de 2 casas — `4.33` onde o `tj3` escreve `4.3`
 * e `5` onde ele escreve `5.0` (achado do golden CLI, 24.7.6).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb l.70-118
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { RealFormat, } from "../../src/format/real-format.ts";
import type { Project, } from "../../src/model/project.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";

/** Projeto mínimo, sem nenhum `numberformat`/`currencyformat` explícito. */
const TJP = `project prj "Defaults" "1.0" 2026-01-05 - 2026-01-16
`;

/** Parse do fixture acima. */
function parse(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  return parser.parse("project",) as Project;
}

describe("24.7 — formatos default do projeto", () => {
  it("`numberFormat` arredonda para 1 casa com ponto decimal", () => {
    const format = parse().get("numberFormat",);

    assertEquals(format instanceof RealFormat, true,);
    assertEquals((format as RealFormat).format(4.3333,), "4.3",);
    assertEquals((format as RealFormat).format(5,), "5.0",);
    assertEquals((format as RealFormat).format(-2.25,), "-2.3",);
  });

  it("`currencyFormat` usa 2 casas e vírgula decimal", () => {
    const format = parse().get("currencyFormat",);

    assertEquals(format instanceof RealFormat, true,);
    assertEquals((format as RealFormat).format(620,), "620,00",);
    assertEquals((format as RealFormat).format(1234.5,), "1234,50",);
  });

  it("`timeFormat`/`shortTimeFormat` trazem o default do Ruby", () => {
    const project = parse();

    assertEquals(project.get("timeFormat",), "%Y-%m-%d",);
    assertEquals(project.get("shortTimeFormat",), "%H:%M",);
  });

  it("`projectids` lista o id do projeto", () => {
    assertEquals(parse().get("projectids",), ["prj",],);
  });
});
