/**
 * Corpus inventory for the e2e golden suite (26.1, F21 wave 1).
 *
 * Scans the committed fixture sources (`docs/Learning/mwe*` and the
 * TaskJuggler TestSuite) and builds `tests/fixtures/corpus.json` — the
 * single inventory consumed by the Ruby oracle (`cli-tj3.rb`) and the CLI
 * runner test. Fixtures are referenced in place, never copied (ADR 042).
 *
 * Run `deno task corpus:generate` to regenerate the manifest.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.1)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */

/** A fixture source directory and the file pattern it contributes. */
export interface CorpusGroup {
  /** Group id, also the fixture id prefix (e.g. `syntax-correct`). */
  id: string;
  /** Directory relative to the repository root. */
  dir: string;
  /** Which files inside `dir` are fixtures. */
  pattern: "tutorial" | "tjp" | "smx";
}

/** The corpus groups, in manifest order (counts measured 2026-11-15). */
export const GROUPS: readonly CorpusGroup[] = [
  { id: "mwe", dir: "docs/Learning", pattern: "tutorial", },
  {
    id: "syntax-correct",
    dir: "docs/taskjuggler/test/TestSuite/Syntax/Correct",
    pattern: "tjp",
  },
  {
    id: "syntax-errors",
    dir: "docs/taskjuggler/test/TestSuite/Syntax/Errors",
    pattern: "tjp",
  },
  {
    id: "scheduler-correct",
    dir: "docs/taskjuggler/test/TestSuite/Scheduler/Correct",
    pattern: "tjp",
  },
  {
    id: "scheduler-errors",
    dir: "docs/taskjuggler/test/TestSuite/Scheduler/Errors",
    pattern: "tjp",
  },
  {
    id: "report-generator",
    dir: "docs/taskjuggler/test/TestSuite/ReportGenerator/Correct",
    pattern: "tjp",
  },
  {
    id: "html-reports",
    dir: "docs/taskjuggler/test/TestSuite/HTML-Reports",
    pattern: "tjp",
  },
  {
    id: "csv-reports",
    dir: "docs/taskjuggler/test/TestSuite/CSV-Reports",
    pattern: "tjp",
  },
  {
    id: "export-refs",
    dir: "docs/taskjuggler/test/TestSuite/Export-Reports/refs",
    pattern: "tjp",
  },
  {
    id: "parity",
    dir: "packages/cli/tests/fixtures/golden",
    pattern: "smx",
  },
];

/** One fixture in the manifest. */
export interface Fixture {
  /** Unique id: `<group>/<stem>` (mwe uses the tutorial directory name). */
  id: string;
  /** Path relative to the repository root. */
  path: string;
}

/** A group section of the manifest. */
export interface ManifestGroup {
  id: string;
  dir: string;
  count: number;
  fixtures: Fixture[];
}

/** The full corpus manifest (shape of `tests/fixtures/corpus.json`). */
export interface CorpusManifest {
  groups: ManifestGroup[];
  total: number;
}

/**
 * Derives the unique fixture id from its group and path.
 *
 * mwe fixtures are `docs/Learning/mweNNN/tutorial.tjp` — the directory name
 * is the identity. Every other fixture is identified by its file stem; the
 * group prefix keeps ids unique across directories (e.g. `Account.tjp`
 * exists in both Syntax/Correct and Export-Reports/refs).
 */
export function fixtureId(groupId: string, path: string,): string {
  const parts = path.split("/",);
  const stem = groupId === "mwe"
    ? parts[parts.length - 2]!
    : parts[parts.length - 1]!.replace(/\.(tjp|smx)$/, "",);
  return `${groupId}/${stem}`;
}

/**
 * Builds the manifest from scanned entries: groups in `GROUPS` order,
 * fixtures sorted by id, per-group counts and total. Throws on duplicate
 * ids or unknown groups — the manifest is a contract, not a best effort.
 */
export function buildManifest(
  entries: readonly { group: string; path: string }[],
): CorpusManifest {
  const byGroup = new Map<string, Fixture[]>();
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!GROUPS.some((g,) => g.id === entry.group)) {
      throw new Error(`unknown group: ${entry.group}`,);
    }
    const id = fixtureId(entry.group, entry.path,);
    if (seen.has(id,)) {
      throw new Error(`duplicate fixture id: ${id}`,);
    }
    seen.add(id,);
    const list = byGroup.get(entry.group,) ?? [];
    list.push({ id, path: entry.path, },);
    byGroup.set(entry.group, list,);
  }
  const groups: ManifestGroup[] = [];
  for (const group of GROUPS) {
    const fixtures = byGroup.get(group.id,);
    if (fixtures === undefined) continue;
    fixtures.sort((a, b,) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    groups.push({
      id: group.id,
      dir: group.dir,
      count: fixtures.length,
      fixtures,
    },);
  }
  return { groups, total: seen.size, };
}

/** Lists the fixture paths of one group under `root` (repository-relative). */
function scanGroup(root: string, group: CorpusGroup,): string[] {
  const paths: string[] = [];
  for (const entry of Deno.readDirSync(root + group.dir,)) {
    if (group.pattern === "tutorial") {
      if (!entry.isDirectory || !/^mwe\d+$/.test(entry.name,)) continue;
      const path = `${group.dir}/${entry.name}/tutorial.tjp`;
      try {
        Deno.statSync(root + path,);
      } catch {
        continue;
      }
      paths.push(path,);
    } else if (entry.isFile && entry.name.endsWith(`.${group.pattern}`,)) {
      paths.push(`${group.dir}/${entry.name}`,);
    }
  }
  return paths;
}

/** Scans every group under `root` and builds the manifest. */
export function scanCorpus(root: string,): CorpusManifest {
  const entries: { group: string; path: string }[] = [];
  for (const group of GROUPS) {
    for (const path of scanGroup(root, group,)) {
      entries.push({ group: group.id, path, },);
    }
  }
  return buildManifest(entries,);
}

/** Regenerates `tests/fixtures/corpus.json` (deno-fmt-compatible JSON). */
export async function writeManifest(root: string,): Promise<CorpusManifest> {
  const manifest = scanCorpus(root,);
  await Deno.mkdir(root + "tests/fixtures", { recursive: true, },);
  await Deno.writeTextFile(
    root + "tests/fixtures/corpus.json",
    JSON.stringify(manifest, null, 2,) + "\n",
  );
  return manifest;
}

if (import.meta.main) {
  const root = new URL("../../", import.meta.url,).pathname;
  const manifest = await writeManifest(root,);
  console.log(
    `tests/fixtures/corpus.json — ${manifest.total} fixtures in ${manifest.groups.length} groups`,
  );
}
