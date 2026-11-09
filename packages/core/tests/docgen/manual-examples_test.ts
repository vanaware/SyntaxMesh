/**
 * Os exemplos do manual são executáveis.
 *
 * Todo bloco de código indentado dos capítulos que comece com `project` é um
 * projeto completo — o manual promete isso ao leitor —, então cada um tem de
 * passar pelo parser real. O teste é o que mantém a prosa honesta: uma
 * keyword renomeada ou uma forma de sintaxe que o port não aceita aparece
 * aqui antes de chegar ao `syntaxmesh man --format html`.
 *
 * @see packages/core/src/docgen/manual/chapters-*.ts
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MANUAL_CHAPTERS, } from "../../src/docgen/manual/chapters.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";

interface Example {
  chapter: string;
  text: string;
}

/**
 * Blocos de código dos capítulos.
 *
 * `onlyProjects` filtra os que declaram `project` (os demais são fragmentos de
 * atributo, que não fecham um arquivo por si sós).
 */
function examples(onlyProjects = false,): Example[] {
  const found: Example[] = [];
  for (const chapter of MANUAL_CHAPTERS) {
    let block: string[] = [];
    const flush = () => {
      if (block.length > 0) {
        const text = block.join("\n",);
        block = [];
        // Exemplos com linha de comando não são arquivos do dialeto.
        if (!text.includes("syntaxmesh ",)) {
          if (!onlyProjects || /^\s*project\s/m.test(text,)) {
            found.push({ chapter: chapter.name, text, },);
          }
        }
      }
    };
    for (const line of chapter.text.split("\n",)) {
      if (/^( {2,}|\t)/.test(line,) && line.trim() !== "") {
        block.push(line.replace(/^ {2}/, "",),);
      } else flush();
    }
    flush();
  }
  return found;
}

describe("manual — exemplos executáveis", () => {
  it("os capítulos têm exemplos de projeto completo", () => {
    const projects = examples(true,);
    assert(projects.length >= 5,);
  });

  it("todo exemplo de projeto completo passa pelo parser", () => {
    const failures: string[] = [];
    for (const example of examples(true,)) {
      const handler = MessageHandlerInstance.instance;
      handler.reset();
      const spelled = new TaskJuggler();
      if (!spelled.parseContent(example.text, "manual-example.smx",)) {
        const reasons = handler.messages
          .map((message,) => `${message.id}: ${message.message}`)
          .join("; ",);
        failures.push(`[${example.chapter}] ${reasons}\n${example.text}`,);
      }
    }
    assertEquals(failures, [],);
  });

  it("nenhum exemplo cita a extensão legada", () => {
    for (const example of examples()) {
      assert(!/\.tjp\b|\.tji\b/i.test(example.text,), example.text,);
    }
  });

  it("nenhum exemplo menciona o projeto de origem da gramática", () => {
    for (const example of examples()) {
      assert(!/taskjuggler/i.test(example.text,), example.text,);
    }
  });
});
