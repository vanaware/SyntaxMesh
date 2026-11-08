/**
 * Fase 24 (24.2.2–24.2.6) — `TaskJuggler.parse`/`parseContent` com provedor de
 * conteúdo injetado.
 *
 * O core não toca em disco: o texto dos arquivos chega por
 * `FileContentProvider` e os `include` são resolvidos **relativos ao arquivo
 * que inclui** (semântica `FileInstance`/`Dir` do Ruby), inclusive com `..`.
 * O teste usa o corpus real do TaskJuggler (`Include.tjp` + 2 níveis de `.tji`)
 * lido pelo próprio teste — o parser nunca vê o filesystem.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb (l.44-121)
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { TaskJuggler, } from "../src/taskjuggler.ts";
import { MessageHandlerInstance, } from "../src/message-handler.ts";
import type { Project, } from "../src/model/project.ts";
import type { PropertyTreeNode, } from "../src/model/property-tree-node.ts";

/** Raiz do corpus Ruby usado como fixture. */
const CORPUS = new URL(
  "../../../docs/taskjuggler/test/TestSuite/Syntax/Correct/",
  import.meta.url,
);

/** Fechamento completo (master + 2 níveis de includes) do `Include.tjp`. */
const INCLUDE_CLOSURE = [
  "Include.tjp",
  "include/dir3/all.tji",
  "include/dir3/file1.tji",
  "include/dir3/file2.tji",
  "include/file1.tji",
  "include/dir1/file2.tji",
  "include/dir1/file5.tji",
  "include/dir2/file3.tji",
];

/** Lê o corpus para um `Map<path, content>` (caminhos sem `./`). */
function closureMap(files: string[] = INCLUDE_CLOSURE,): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    map.set(file, Deno.readTextFileSync(new URL(file, CORPUS,),),);
  }
  return map;
}

/** Provider fake: consulta o `Map` e explode fora dele (como o Ruby). */
function providerOf(map: Map<string, string>,): (path: string,) => string {
  return (path: string,) => {
    const content = map.get(path,);
    if (content === undefined) {
      throw new Error(`Cannot open file ${path}`,);
    }
    return content;
  };
}

/** Coleta os rótulos (`name`) das propriedades de um conjunto. */
function namesOf(set: { toArray(): unknown[] },): string[] {
  return (set.toArray() as PropertyTreeNode[]).map((n,) => n.name);
}

describe("TaskJuggler.parse", () => {
  let tj: TaskJuggler;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    tj = new TaskJuggler();
  },);

  it("monta o projeto a partir do provedor injetado (24.2.2)", async () => {
    const map = closureMap();
    const ok = await tj.parse(["Include.tjp",], providerOf(map,),);

    assertEquals(ok, true,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    const project = tj.project as Project | null;
    assert(project !== null,);
    assertEquals(project.id, "include_test",);
    assertEquals(project.name, "Include Test",);
    assertEquals(project.inputFiles.includes("Include.tjp",), true,);
  });

  it("resolve include aninhado relativo ao arquivo que inclui (24.2.4)", async () => {
    const requested: string[] = [];
    const map = closureMap();
    const base = providerOf(map,);
    const provider = (path: string,) => {
      requested.push(path,);
      return base(path,);
    };

    assertEquals(await tj.parse(["Include.tjp",], provider,), true,);
    const project = tj.project as Project;

    // dir3/all.tji → file1.tji/file2.tji em dir3; file1.tji → dir1/file2.tji;
    // dir1/file2.tji → ../dir2/file3.tji e dir1/file5.tji.
    assert(requested.includes("include/dir3/all.tji",),);
    assert(requested.includes("include/dir3/file1.tji",),);
    assert(requested.includes("include/dir1/file2.tji",),);
    assert(requested.includes("include/dir2/file3.tji",),);
    assert(
      !requested.some((p,) => p.includes("..",)),
      `caminho não normalizado: ${requested.join(", ",)}`,
    );

    // `resource "R"` sem id explícito recebe `_Resource_N` do
    // `PropertyTreeNode` (mesmo fallback do Ruby) — compara pelo rótulo.
    assertEquals(namesOf(project.resources,).sort(), [
      "R",
      "R2",
      "RF1",
      "RF2",
    ],);
    assertEquals(namesOf(project.tasks,), ["Foo",],);
    // O nome qualificado do include entra em `inputFiles` (Ruby l.79) — o
    // scanner prefixa o diretório do pai (`./`), como no Ruby.
    assert(
      project.inputFiles.some((f,) => f.endsWith("include/dir3/all.tji",)),
      project.inputFiles.join(", ",),
    );
  });

  it("arquivo ausente vira mensagem de erro, sem exceção (24.2.5)", async () => {
    const map = closureMap();
    let threw: unknown = null;
    let ok = true;
    try {
      ok = await tj.parse(["Nope.tjp",], providerOf(map,),);
    } catch (error) {
      threw = error;
    }

    assertEquals(threw, null,);
    assertEquals(ok, false,);
    assert(MessageHandlerInstance.instance.errors > 0,);
    const messages = MessageHandlerInstance.instance.messages;
    const open = messages.find((m,) => m.id === "open_file");
    assert(
      open !== undefined,
      `ids: ${messages.map((m,) => m.id).join(", ",)}`,
    );
    assert(open.to_s().includes("Cannot open file Nope.tjp",),);
    assertEquals(tj.project, null,);
  });

  it("include ausente registra bad_include e falha o parse (24.2.5)", async () => {
    const map = closureMap(["Include.tjp",],);
    const ok = await tj.parse(["Include.tjp",], providerOf(map,),);

    assertEquals(ok, false,);
    const messages = MessageHandlerInstance.instance.messages;
    const bad = messages.find((m,) => m.id === "bad_include");
    assert(
      bad !== undefined,
      `ids: ${messages.map((m,) => m.id).join(", ",)}`,
    );
    assert(
      bad.to_s().includes("Cannot open include file",),
      bad.to_s(),
    );
    assert(bad.to_s().includes("include/dir3/all.tji",), bad.to_s(),);
  });

  it("keepParser retém o parser; default limpa (Ruby l.93)", async () => {
    const map = closureMap();
    await tj.parse(["Include.tjp",], providerOf(map,), true,);
    assert(tj.parser !== null,);

    const other = new TaskJuggler();
    await other.parse(["Include.tjp",], providerOf(map,),);
    assertEquals(other.parser, null,);
  });
});

/** Texto de projeto mínimo e válido (version entre aspas, como no TJP). */
const PROJECT_TEXT =
  'project acme "Acme" "1.0" 2026-01-01 +2m {\n  timezone "UTC"\n}\n';

describe("TaskJuggler.parseContent", () => {
  let tj: TaskJuggler;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    tj = new TaskJuggler();
  },);

  it("monta o projeto a partir de texto em memória (24.2.6)", () => {
    const ok = tj.parseContent(PROJECT_TEXT,);

    assertEquals(ok, true,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals((tj.project as Project).name, "Acme",);
  });

  it("usa o nome informado em `inputFiles` (24.2.6)", () => {
    const ok = tj.parseContent(PROJECT_TEXT, "acme.smx",);

    assertEquals(ok, true,);
    const project = tj.project as Project;
    assertEquals(project.inputFiles, ["acme.smx",],);
  });

  it("texto inválido devolve false e conta erros", () => {
    const ok = tj.parseContent("isso não é um projeto",);

    assertEquals(ok, false,);
    assert(MessageHandlerInstance.instance.errors > 0,);
  });
});
