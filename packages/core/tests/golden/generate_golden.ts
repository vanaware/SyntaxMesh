#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Regenerates `attributes.golden.json` from the Ruby golden script.
 *
 * Usage: deno task golden:generate
 *
 * Requires: `tj3` (TaskJuggler Ruby) on PATH.
 */

const scripts: Array<{ name: string; rubyScript: URL; outputPath: URL }> = [
  {
    name: "attributes",
    rubyScript: new URL(
      "../../../../scripts/golden/attributes.rb",
      import.meta.url,
    ),
    outputPath: new URL("./attributes.golden.json", import.meta.url,),
  },
  {
    name: "attribute-definitions",
    rubyScript: new URL(
      "../../../../scripts/golden/attribute-definitions.rb",
      import.meta.url,
    ),
    outputPath: new URL(
      "./attribute-definitions.golden.json",
      import.meta.url,
    ),
  },
  {
    name: "limits",
    rubyScript: new URL(
      "../../../../scripts/golden/limits.rb",
      import.meta.url,
    ),
    outputPath: new URL("./limits.golden.json", import.meta.url,),
  },
  {
    name: "shift-assignments",
    rubyScript: new URL(
      "../../../../scripts/golden/shift-assignments.rb",
      import.meta.url,
    ),
    outputPath: new URL("./shift-assignments.golden.json", import.meta.url,),
  },
  {
    name: "finance-mwe004",
    rubyScript: new URL(
      "../../../../scripts/golden/finance-mwe004.rb",
      import.meta.url,
    ),
    outputPath: new URL("./finance-mwe004.golden.json", import.meta.url,),
  },
  {
    name: "finance-variations",
    rubyScript: new URL(
      "../../../../scripts/golden/finance-variations.rb",
      import.meta.url,
    ),
    outputPath: new URL("./finance-variations.golden.json", import.meta.url,),
  },
  {
    name: "logical-expressions",
    rubyScript: new URL(
      "../../../../scripts/golden/logical-expressions.rb",
      import.meta.url,
    ),
    outputPath: new URL(
      "./logical-expressions.golden.json",
      import.meta.url,
    ),
  },
  {
    name: "richtext",
    rubyScript: new URL(
      "../../../../scripts/golden/richtext.rb",
      import.meta.url,
    ),
    outputPath: new URL(
      "../richtext/golden/richtext.golden.json",
      import.meta.url,
    ),
  },
  {
    name: "journal",
    rubyScript: new URL(
      "../../../../scripts/golden/journal.rb",
      import.meta.url,
    ),
    outputPath: new URL("./journal.golden.json", import.meta.url,),
  },
  {
    name: "leaves",
    rubyScript: new URL(
      "../../../../scripts/golden/leaves.rb",
      import.meta.url,
    ),
    outputPath: new URL("./leaves.golden.json", import.meta.url,),
  },
  // 17.16: serialização XML/HTML (XMLElement..HTMLDocument) e iCalendar
  // (ICalendar/Component + foldLines). DTSTAMP é normalizado no teste TS.
  {
    name: "html-xml",
    rubyScript: new URL(
      "../../../../scripts/golden/html-xml.rb",
      import.meta.url,
    ),
    outputPath: new URL("./html-xml.golden.json", import.meta.url,),
  },
  {
    name: "ical",
    rubyScript: new URL(
      "../../../../scripts/golden/ical.rb",
      import.meta.url,
    ),
    outputPath: new URL("./ical.golden.json", import.meta.url,),
  },
];

for (const { name, rubyScript, outputPath, } of scripts) {
  const proc = new Deno.Command("ruby", {
    args: [rubyScript.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);

  const result = proc.outputSync();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr,);
    console.error(`Ruby script ${name} failed:\n${stderr}`,);
    Deno.exit(1,);
  }

  // Normaliza a serialização para o estilo do `deno fmt` (JSON.stringify com
  // indent 2): o `JSON.pretty_generate` do Ruby formata arrays vazias em várias
  // linhas (`[\n\n]`), o que quebraria o `deno fmt --check` do golden commitado.
  // Re-stringificar aqui garante que a saída de `golden:generate` seja sempre
  // byte-idêntica ao arquivo commitado (idempotência + fmt limpo).
  let stdout = new TextDecoder().decode(result.stdout,);

  // Normalize Ruby proc memory addresses to a stable placeholder.
  // Legado: `attributes.rb` agora emit tokens estáveis (__to_s_seq__ etc.),
  // então não há Procs a normalizar; o regex permanece como no-op defensivo.
  stdout = stdout.replace(
    /#<Proc:(0x[0-9a-f]+) (.+\/scripts\/golden\/\w+\.rb:\d+ \(lambda\))>/g,
    "#<Proc:0x000000000000 $2>",
  );

  // Extract the last JSON object from stdout. Ruby scripts may emit
  // informational `puts` messages before the JSON output; we grab the
  // trailing JSON object so the parser doesn't choke on log lines.
  const jsonMatch = stdout.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${name} has no JSON object:\n${stdout}`,);
    Deno.exit(1,);
  }
  stdout = jsonMatch[0];

  // Validate JSON before writing
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout,);
  } catch (e) {
    console.error(`Ruby output ${name} is not valid JSON:`, e,);
    console.error(`Raw output:\n${stdout}`,);
    Deno.exit(1,);
  }

  await Deno.writeTextFile(
    outputPath,
    JSON.stringify(parsed, null, 2,) + "\n",
  );
  console.log(`Generated ${outputPath.pathname}`,);
}

// ---------------------------------------------------------------------------
// Parser golden (10.19): 9 scripts de MWE (tj3 --check-syntax) + Correct +
// Errors (API Ruby MessageChecker-style), mesclados em parser.golden.json.
// ---------------------------------------------------------------------------

const parserScripts = [
  ...Array.from(
    { length: 9, },
    (_, i,) => `parser-mwe${String(i + 1,).padStart(3, "0",)}.rb`,
  ),
  "parser-syntax-correct.rb",
  "parser-syntax-errors.rb",
];

type ParserCase = {
  file: string;
  ok: boolean;
  messages: unknown[];
};

const parserCases: ParserCase[] = [];
for (const script of parserScripts) {
  const url = new URL(`../../../../scripts/golden/${script}`, import.meta.url,);
  const proc = new Deno.Command("ruby", {
    args: [url.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);
  const result = proc.outputSync();
  if (!result.success) {
    console.error(
      `Ruby script ${script} failed:\n` +
        new TextDecoder().decode(result.stderr,),
    );
    Deno.exit(1,);
  }
  const text = new TextDecoder().decode(result.stdout,);
  const jsonMatch = text.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${script} has no JSON object:\n${text}`,);
    Deno.exit(1,);
  }
  const parsed = JSON.parse(jsonMatch[0],) as {
    cases?: ParserCase[];
    file?: string;
  };
  if (parsed.cases) {
    parserCases.push(...parsed.cases,);
  } else {
    parserCases.push(parsed as ParserCase,);
  }
}

const parserOut = new URL("./parser.golden.json", import.meta.url,);
await Deno.writeTextFile(
  parserOut,
  JSON.stringify({ cases: parserCases, }, null, 2,) + "\n",
);
console.log(
  `Generated ${parserOut.pathname} (${parserCases.length} cases)`,
);

// ---------------------------------------------------------------------------
// Reports golden (14.23): 9 scripts de MWE + TestSuite (ReportGenerator/
// Correct + HTML-Reports + CSV-Reports), todos via reports-common.rb (tj3 real,
// formato intermediário). Mesclados em reports.golden.json.
// ---------------------------------------------------------------------------

type ReportRef = {
  id: string;
  name: string;
  type: string;
  formats: string[];
  table?: { header: unknown[]; rows: unknown[][] };
  error?: string;
};
type ReportCase = {
  file: string;
  tz: string;
  error: string | null;
  reports: ReportRef[];
};

const reportScripts = [
  ...Array.from(
    { length: 9, },
    (_, i,) => `reports-mwe${String(i + 1,).padStart(3, "0",)}.rb`,
  ),
  "reports-syntax-correct.rb",
];

const reportCases: ReportCase[] = [];
for (const script of reportScripts) {
  const url = new URL(`../../../../scripts/golden/${script}`, import.meta.url,);
  const proc = new Deno.Command("ruby", {
    args: [url.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);
  const result = proc.outputSync();
  if (!result.success) {
    console.error(
      `Ruby script ${script} failed:\n` +
        new TextDecoder().decode(result.stderr,),
    );
    Deno.exit(1,);
  }
  const text = new TextDecoder().decode(result.stdout,);
  const jsonMatch = text.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${script} has no JSON object:\n${text}`,);
    Deno.exit(1,);
  }
  const parsed = JSON.parse(jsonMatch[0],) as {
    cases?: ReportCase[];
    file?: string;
  };
  if (parsed.cases) reportCases.push(...parsed.cases,);
  else reportCases.push(parsed as ReportCase,);
}

const reportsOut = new URL("./reports.golden.json", import.meta.url,);
await Deno.writeTextFile(
  reportsOut,
  JSON.stringify({ cases: reportCases, }, null, 2,) + "\n",
);
const reportCount = reportCases.reduce((n, c,) => n + c.reports.length, 0,);
console.log(
  `Generated ${reportsOut.pathname} (${reportCases.length} files, ${reportCount} reports)`,
);

// ---------------------------------------------------------------------------
// MSPDI golden (14C.4.1): exportador MSP do tj3 real sobre o fixture
// `14c-mspdi.tjp`, normalizado pelo walker REXML de `scripts/golden/mspdi-tj3.rb`
// (espelhado em `mspdi-normalize.ts` no lado TS).
// ---------------------------------------------------------------------------

const mspdiUrl = new URL(
  "../../../../scripts/golden/mspdi-tj3.rb",
  import.meta.url,
);
const mspdiProc = new Deno.Command("ruby", {
  args: [mspdiUrl.pathname,],
  stdout: "piped",
  stderr: "piped",
},);
const mspdiResult = mspdiProc.outputSync();
if (!mspdiResult.success) {
  console.error(
    "Ruby script mspdi-tj3 failed:\n" +
      new TextDecoder().decode(mspdiResult.stderr,),
  );
  Deno.exit(1,);
}
const mspdiText = new TextDecoder().decode(mspdiResult.stdout,);
const mspdiMatch = mspdiText.match(/\{[\s\S]*\}/,);
if (!mspdiMatch) {
  console.error(`Ruby output mspdi-tj3 has no JSON object:\n${mspdiText}`,);
  Deno.exit(1,);
}
const mspdiParsed = JSON.parse(mspdiMatch[0],) as {
  cases: Array<{ error: string | null }>;
};
if (mspdiParsed.cases.some((c,) => c.error !== null)) {
  console.error(
    "Ruby mspdi-tj3 reportou erro: " +
      JSON.stringify(mspdiParsed.cases.map((c,) => c.error),),
  );
  Deno.exit(1,);
}
const mspdiOut = new URL("./mspdi.golden.json", import.meta.url,);
await Deno.writeTextFile(
  mspdiOut,
  JSON.stringify(mspdiParsed, null, 2,) + "\n",
);
console.log(`Generated ${mspdiOut.pathname}`,);

// ---------------------------------------------------------------------------
// Gantt golden (15.13): 7 MWEs com coluna `chart` + o corpus HTML-Reports do
// TestSuite, todos via gantt-common.rb (tj3 real, geometria do chart).
// Mesclados em gantt.golden.json.
// ---------------------------------------------------------------------------

type GanttContentSnapshot = {
  kind: string;
  x?: number;
  end?: number;
  y?: number;
  w?: number;
  yLevels?: number[] | null;
  drawFrame?: boolean;
};
type GanttLineSnapshot = {
  y: number;
  height: number;
  category: string | null;
  content: GanttContentSnapshot[];
};
type GanttChartSnapshot = {
  report: string;
  column?: number;
  error?: string;
  scale?: string;
  start?: number;
  end?: number;
  width?: number;
  height?: number;
  viewWidth?: number | null;
  scrollbar?: boolean;
  header?: {
    height: number;
    nowLineX: number | null;
    markdateLineX: number | null;
    gridLines: number[];
    cellStartDates: number[];
  };
  lines?: GanttLineSnapshot[];
  depArrows?: number[][][];
  arrowHeads?: number[][];
};
type GanttCase = {
  file: string;
  tz: string;
  error: string | null;
  chartErrors?: Array<{ report: string; error: string }>;
  charts: GanttChartSnapshot[];
};

// Só os MWEs que têm coluna `chart` (mwe005 e mwe007 não têm) — ver 15.13.1.
const ganttScripts = [
  "001",
  "002",
  "003",
  "004",
  "006",
  "008",
  "009",
].map((n,) => `gantt-mwe${n}.rb`).concat("gantt-testsuite.rb",);

const ganttCases: GanttCase[] = [];
for (const script of ganttScripts) {
  const url = new URL(`../../../../scripts/golden/${script}`, import.meta.url,);
  const proc = new Deno.Command("ruby", {
    args: [url.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);
  const result = proc.outputSync();
  if (!result.success) {
    console.error(
      `Ruby script ${script} failed:\n` +
        new TextDecoder().decode(result.stderr,),
    );
    Deno.exit(1,);
  }
  const text = new TextDecoder().decode(result.stdout,);
  const jsonMatch = text.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${script} has no JSON object:\n${text}`,);
    Deno.exit(1,);
  }
  const parsed = JSON.parse(jsonMatch[0],) as {
    cases?: GanttCase[];
    file?: string;
    charts?: GanttChartSnapshot[];
  };
  if (parsed.cases) {
    // `gantt-testsuite.rb` devolve o envelope; descarta arquivos sem chart.
    // Casos com `chartErrors` mas nenhum chart ficam: o motivo da falha do
    // tj3 deve aparecer no teste (como `it` pulado), não desaparecer.
    ganttCases.push(
      ...parsed.cases.filter((c,) =>
        (c.charts ?? []).length > 0 || (c.chartErrors ?? []).length > 0
      ),
    );
  } else {
    ganttCases.push(parsed as GanttCase,);
  }
}

const ganttOut = new URL("./gantt.golden.json", import.meta.url,);
await Deno.writeTextFile(
  ganttOut,
  JSON.stringify({ cases: ganttCases, }, null, 2,) + "\n",
);
const ganttChartCount = ganttCases.reduce((n, c,) => n + c.charts.length, 0,);
const ganttLineCount = ganttCases.reduce(
  (n, c,) => n + c.charts.reduce((m, ch,) => m + (ch.lines?.length ?? 0), 0,),
  0,
);
console.log(
  `Generated ${ganttOut.pathname} (${ganttCases.length} files, ${ganttChartCount} charts, ${ganttLineCount} lines)`,
);
