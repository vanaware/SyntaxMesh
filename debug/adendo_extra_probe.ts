/**
 * adendo_extra_probe — mapeia o que o parser já aceita vs o §12 do plano.
 *
 * Roda cada forma de booking do «Adendo Extra» (fase-14-relatorios-complemento
 * .md §12) isoladamente sobre um corpo de projeto base e imprime ok / ids de
 * mensagem. Ferramenta de diagnóstico:
 *   deno run -A debug/adendo_extra_probe.ts
 */
import { MessageHandlerInstance, } from "../packages/core/src/message-handler.ts";
import { ProjectFileParser, } from "../packages/core/src/parser/mod.ts";

const BASE = [
  'project prj "Test" "1.0" 2026-01-01 - 2026-12-31\n',
  'task f "Foundation" {\n}\n',
  'task f2 "Foundation 2" {\n}\n',
  'resource eng "Engineer" {\n}\n',
  'account sw "Software" {\n}\n',
  'account costs "Custos" {\n  account mats "Materials" {\n    aggregate materials\n  }\n}\n',
  'material steel "Aço" {\n  unit "kg"\n  unitprice 25\n}\n',
  'material cement "Cimento" {\n  unit "kg"\n  unitprice 0.45\n}\n',
].join("",);

/** Caso: [nome, snippet, esperado] — esperado 'ok' | 'erro'. */
const CASES: Array<[string, string, "ok" | "erro",]> = [
  // ---- §12.3 sintaxe curta ----------------------------------------------
  [
    "task: booking effort <id> <interval>",
    'task t1 "T1" {\n  booking effort eng 2026-02-01 - 2026-02-10 {\n    sloppy 2\n  }\n}\n',
    "ok",
  ],
  [
    "task: booking <id> <interval> (curto)",
    'task t2 "T2" {\n  booking eng 2026-02-01 - 2026-02-10 {\n    sloppy 2\n  }\n}\n',
    "ok",
  ],
  [
    "task: booking charge value <v> on <d>",
    'task t3 "T3" {\n  booking charge value 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "task: booking charge <v> on <d> (curto)",
    'task t4 "T4" {\n  booking charge 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "task: booking charge <desc> <v> (revisão)",
    'task t4b "T4B" {\n  booking charge "Licenças" 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "task: booking charge <desc> value <v>",
    'task t4c "T4C" {\n  booking charge "Licenças" value 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "task: booking charge <desc> -<v> (estorno)",
    'task t4d "T4D" {\n  booking charge "Estorno" -1200 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "task: booking charge <res> <v> (não aceito)",
    'task t4e "T4E" {\n  booking charge eng 48000 on 2026-02-15\n}\n',
    "erro",
  ],
  [
    "task: booking material <id> quantity <q>",
    'task t5 "T5" {\n  booking material steel quantity 2100 on 2026-02-05\n}\n',
    "ok",
  ],
  [
    "task: booking material <id> <q> (curto)",
    'task t6 "T6" {\n  booking material steel 2100 on 2026-02-05\n}\n',
    "ok",
  ],
  [
    "resource: booking <task> <interval>",
    'resource r2 "E2" {\n  booking f 2026-02-01 - 2026-02-10 {\n    sloppy 2\n  }\n}\n',
    "ok",
  ],
  [
    "resource: booking effort <task> <interval>",
    'resource r3 "E3" {\n  booking effort f 2026-02-01 - 2026-02-10\n}\n',
    "ok",
  ],
  [
    "resource: booking charge <task> value <v>",
    'resource r4 "E4" {\n  booking charge f value 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "resource: booking charge <task> <v> (curto)",
    'resource r5 "E5" {\n  booking charge f 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "resource: booking charge <task> <desc> <v>",
    'resource r5b "E5B" {\n  booking charge f "ajuda de custo" 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "material: booking <task> quantity <q>",
    'material m2 "M2" {\n  unit "kg"\n  booking f quantity 2100 on 2026-02-05\n}\n',
    "ok",
  ],
  [
    "material: booking <task> <q> (curto)",
    'material m3 "M3" {\n  unit "kg"\n  booking f 2100 on 2026-02-05\n}\n',
    "ok",
  ],
  [
    "material: booking charge <task> value <v>",
    'material m4 "M4" {\n  unit "kg"\n  booking charge f value 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "material: booking charge <task> <v> (curto)",
    'material m5 "M5" {\n  unit "kg"\n  booking charge f 48000 on 2026-02-15\n}\n',
    "ok",
  ],
  [
    "material: booking charge <task> <desc> <v>",
    'material m5b "M5B" {\n  unit "kg"\n  booking charge "Foundation" "frete" 1200 on 2026-02-15\n}\n',
    "ok",
  ],
  // ---- §12.1 estoque (sem task, aceita negativo) -------------------------
  [
    "material: estoque + sem task",
    'material m6 "M6" {\n  unit "kg"\n  chargeset mats 100%\n  booking quantity 100 unitprice 26.5 on 2026-11-01\n}\n',
    "ok",
  ],
  [
    "material: estoque - sem task",
    'material m7 "M7" {\n  unit "kg"\n  chargeset mats 100%\n  booking quantity -100 unitprice 26.5 on 2026-11-02\n}\n',
    "ok",
  ],
  [
    "material: estoque sem chargeset",
    'material m8 "M8" {\n  unit "kg"\n  booking quantity 100 on 2026-11-01\n}\n',
    "erro",
  ],
  [
    "material: estoque com task negativa",
    'material ma "MA" {\n  unit "kg"\n  booking f quantity -100 on 2026-11-02\n}\n',
    "erro",
  ],
  // ---- número negativo no lexer (fora do escopo: TJ também não aceita) ----
  [
    "task: charge -500 perday",
    'task tb "TB" {\n  chargeset mats 100%\n  charge -500 perday\n}\n',
    "erro",
  ],
  // ---- §12.2 unit price calculado por composição -------------------------
  [
    "material: composição material <id> <q>",
    'material m9 "M9" {\n  unit "m³"\n  material cement 420\n}\n',
    "ok",
  ],
];

let mismatch = 0;
for (const [name, snippet, expected,] of CASES) {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  const parser = new ProjectFileParser();
  parser.open(BASE + snippet, true, true,);
  let threw: string | null = null;
  try {
    parser.parse("project",);
  } catch (e) {
    threw = (e as Error).message.slice(0, 50,);
  }
  const ids = [
    ...new Set(
      MessageHandlerInstance.instance.messages.map((m,) => m.id),
    ),
  ].join(",",);
  const accepted = threw === null && ids.length === 0;
  const verdict = (expected === "ok") === accepted ? "==" : "!!";
  if (verdict === "!!") mismatch++;
  console.log(
    `${verdict} ${accepted ? "aceita " : "recusa  "} | ${
      name.padEnd(
        44,
      )
    } | esperado=${expected} | ${ids || threw || ""}`,
  );
}
console.log(
  `\n${CASES.length - mismatch}/${CASES.length} casos já batem com o §12.`,
);
