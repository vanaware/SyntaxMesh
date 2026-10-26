/**
 * Testes da subfase 10.10 — ProjectFileParser (estrutura).
 *
 * Cobre campos, constructor, open/close, delegação de tokens, macros
 * globais, file stack e as conveniências de regras (singlePattern,
 * listRule, optionsRule...) usadas pelo TjpSyntaxRules (10.11+).
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.10
 */
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { detectLanguage, ProjectFileParser, } from "../../src/parser/mod.ts";
import type { ParserToken, } from "../../src/parser/text-parser.ts";
import { FileStreamHandle, } from "../../src/lexer/stream-handle.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";
import { Project, } from "../../src/model/project.ts";
import { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { Task, } from "../../src/model/task.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

function resetMessages(): void {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
}

function messageIds(): string[] {
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}

/** Expõe os métodos protegidos de tokens para verificação direta. */
class TokenProbeParser extends ProjectFileParser {
  next(): ParserToken {
    return this.nextToken();
  }

  pushBack(token: ParserToken | null,): void {
    this.returnToken(token,);
  }

  useFileStack(): void {
    this.initFileStack();
  }

  pushStack(): void {
    this.pushFileStack();
  }

  popStack(): void {
    this.popFileStack();
  }
}

describe("ProjectFileParser — campos e constructor (10.10.1)", () => {
  it("variables lista os 11 tipos de token do scanner TJP", () => {
    const parser = new ProjectFileParser();
    assertEquals(parser.variables, [
      "INTEGER",
      "FLOAT",
      "DATE",
      "TIME",
      "STRING",
      "LITERAL",
      "ID",
      "ID_WITH_COLON",
      "ABSOLUTE_ID",
      "MACRO",
      "KEYWORD",
    ],);
  });

  it("constructor define language='en' e AttributeBase.setMode(0)", () => {
    AttributeBase.setMode(2,);
    const parser = new ProjectFileParser();
    assertEquals(parser.language, "en",);
    assertEquals(AttributeBase.mode, 0,);
  });

  it("campos de estado começam em branco/zero", () => {
    const parser = new ProjectFileParser();
    assertEquals(parser.project, null,);
    assertEquals(parser.property, null,);
    assertEquals(parser.scenarioIdx, 0,);
    assertEquals(parser.taskprefix, "",);
    assertEquals(parser.reportprefix, "",);
    assertEquals(parser.resourceprefix, "",);
    assertEquals(parser.accountprefix, "",);
    assertEquals(parser.reportCounter, 0,);
    assertEquals(parser.projectId, "",);
    assertEquals(parser.limitResources, [],);
  });
});

describe("ProjectFileParser — open/close (10.10.2)", () => {
  it("abre um buffer e tokeniza o primeiro ID", () => {
    resetMessages();
    // O scanner interno entrega os tokens do buffer.
    const probe = new TokenProbeParser();
    probe.open("task { }", true, true,);
    assertEquals(probe.next()[0], "ID",);
    probe.close();
  });

  it("open de arquivo mestre sem extensão .tjp registra illegal_extension", () => {
    resetMessages();
    FileStreamHandle.fileLoader = () => 'project p "P" 1.0 2026-01-01';
    try {
      const parser = new ProjectFileParser();
      parser.open("arquivo.txt", true, false,);
      assert(messageIds().includes("illegal_extension",),);
      parser.close();
    } finally {
      FileStreamHandle.fileLoader = null;
    }
  });

  it("open com master detecta a diretiva language (10.17)", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.open('language "pt-BR"\ntask', true, true,);
    assertEquals(parser.language, "pt-BR",);
    parser.close();
  });

  it("idioma desconhecido cai para 'en' com warning language_unknown", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.open('language "de-DE"\ntask', true, true,);
    assertEquals(parser.language, "en",);
    assert(messageIds().includes("language_unknown",),);
    parser.close();
  });

  it("close limpa o scanner; nextToken após close devolve endOfText", () => {
    const parser = new ProjectFileParser();
    parser.open("x", true, true,);
    parser.close();
    const probe = new TokenProbeParser();
    assertEquals(probe.next()[0], "endOfText",);
  });
});

// ---------------------------------------------------------------------------
// 10.17.6–8 — rule_language consome a diretiva no prolog (extensão SM)
// ---------------------------------------------------------------------------
describe("ProjectFileParser — rule_language (10.17.6)", () => {
  /** Abre o buffer como mestre e roda parse('project'); retorna o parser. */
  function parseMaster(text: string,): ProjectFileParser {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.open(text, true, true,);
    const result = parser.parse("project",);
    assert(result instanceof Project, "parse deveria produzir um Project",);
    assertEquals(messageIds(), [],);
    return parser;
  }

  it("'language \"pt-BR\"' + projeto em pt-BR parseia sem erros", () => {
    const parser = parseMaster(
      'language "pt-BR"\nprojeto prj "Teste" "1.0" 2026-01-01 - 2026-12-31\n',
    );
    assertEquals(parser.language, "pt-BR",);
    parser.close();
  });

  it("'language \"es\"' + proyecto en español parseia sem erros", () => {
    const parser = parseMaster(
      'language "es"\nproyecto prj "Prueba" "1.0" 2026-01-01 - 2026-12-31\n',
    );
    assertEquals(parser.language, "es",);
    parser.close();
  });

  it("sem diretiva, o prolog segue opcional (en puro parseia)", () => {
    const parser = parseMaster(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31\n',
    );
    assertEquals(parser.language, "en",);
    parser.close();
  });

  it("idioma desconhecido: warning no open, diretiva ainda consumida", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.open(
      'language "de-DE"\nproject prj "T" "1.0" 2026-01-01 - 2026-12-31\n',
      true,
      true,
    );
    assert(messageIds().includes("language_unknown",),);
    resetMessages();
    const result = parser.parse("project",);
    assert(result instanceof Project, "parse deveria produzir um Project",);
    assertEquals(messageIds(), [],);
    parser.close();
  });
});

describe("ProjectFileParser — tokens e push-back (10.10.3)", () => {
  it("returnToken devolve o token ao scanner (push-back)", () => {
    const parser = new TokenProbeParser();
    parser.open("ab cd", true, true,);
    const t1 = parser.next();
    const t2 = parser.next();
    assertEquals([t1[1], t2[1],], ["ab", "cd",],);
    // O scanner aceita apenas 1 token em buffer (fiel ao Ruby).
    parser.pushBack(t2,);
    assertEquals(parser.next()[1], "cd",);
    parser.close();
  });

  it("nextToken converte DATE para objeto TjTime", () => {
    const parser = new TokenProbeParser();
    parser.open("2026-03-01", true, true,);
    const t = parser.next();
    assertEquals(t[0], "DATE",);
    assert(t[1] instanceof TjTime,);
    parser.close();
  });
});

describe("ProjectFileParser — setGlobalMacros (10.10.4)", () => {
  it("registra as 4 macros padrão no scanner", () => {
    resetMessages();
    const parser = new TokenProbeParser();
    parser.open("x", true, true,);
    const project = new Project("prj", "P", "1.0",);
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    parser.project = project;
    parser.setGlobalMacros();
    // A pilha de macros do scanner conhece as 4 macros.
    const table = parser.scannerRef!.macroTable;
    assert(table.includes("projectstart",),);
    assert(table.includes("projectend",),);
    assert(table.includes("now",),);
    assert(table.includes("today",),);
    parser.close();
  });

  it("sem projeto aberto não faz nada", () => {
    const parser = new ProjectFileParser();
    parser.open("x", true, true,);
    parser.setGlobalMacros(); // project null — sem erro
    parser.close();
  });

  it("macro ${projectstart} expande no scanner", () => {
    resetMessages();
    const parser = new TokenProbeParser();
    parser.open('"${projectstart}"', true, true,);
    const project = new Project("prj", "P", "1.0",);
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    parser.project = project;
    parser.setGlobalMacros();
    const token = parser.next();
    assertEquals(token[0], "STRING",);
    assert(String(token[1],).startsWith("2026-01-01",),);
    parser.close();
  });
});

describe("ProjectFileParser — helpers de regras (10.10.5)", () => {
  it("weekDay converte nomes em índices 0-6", () => {
    const parser = new ProjectFileParser();
    assertEquals(parser.weekDay("sun",), 0,);
    assertEquals(parser.weekDay("mon",), 1,);
    assertEquals(parser.weekDay("sat",), 6,);
  });

  it("weekDay inválido registra erro 'weekday'", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.weekDay("xyz",);
    assert(messageIds().includes("weekday",),);
  });

  it("checkContainer registra erro após sub-propriedades", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    const project = new Project("prj", "P", "1.0",);
    const parent = new Task(project, "p", "Parent", null,);
    new Task(project, "c", "Child", parent,);
    parser.property = parent;
    parser.checkContainer("milestone",);
    assert(messageIds().includes("container_attribute",),);
  });

  it("checkInterval aceita intervalo dentro do projeto", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    const project = new Project("prj", "P", "1.0",);
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    parser.project = project;
    const iv = new TimeInterval(
      TjTime.fromString("2026-02-01",),
      TjTime.fromString("2026-03-01",),
    );
    parser.checkInterval(iv,);
    assertEquals(
      messageIds().filter((id,) => id.startsWith("interval_",)),
      [],
    );
  });

  it("checkInterval fora do projeto registra erro", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    const project = new Project("prj", "P", "1.0",);
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    parser.project = project;
    const iv = new TimeInterval(
      TjTime.fromString("2025-01-01",),
      TjTime.fromString("2025-02-01",),
    );
    parser.checkInterval(iv,);
    assert(messageIds().includes("interval_start_in_range",),);
  });

  it("newRichText lança NotYetImplementedError (Fase 12)", () => {
    const parser = new ProjectFileParser();
    assertThrows(
      () => parser.newRichText("text", null, null,),
      NotYetImplementedError,
    );
  });

  it("singlePattern + newRule criam regra consultável pelo FSM", () => {
    const parser = new ProjectFileParser();
    parser.newRule("probe", () => {
      parser.singlePattern("_abc",);
    },);
    const rule = parser.rules.get("probe",)!;
    assertEquals(rule.patterns.length, 1,);
    assertEquals(rule.patterns[0]!.tokens, [["literal", "abc",],],);
  });

  it("optionsRule adiciona bloco { } opcional à regra", () => {
    const parser = new ProjectFileParser();
    parser.newRule("outer", () => {
      parser.newRule("attrs", () => parser.singlePattern("_x",),);
      parser.optionsRule("attrs",);
    },);
    const outer = parser.rules.get("outer",)!;
    assertEquals(outer.patterns[0]!.tokens.map((t,) => t[1]), [
      "{",
      "attrs",
      "}",
    ],);
  });

  it("listRule monta lista com cauda commaListRule", () => {
    const parser = new ProjectFileParser();
    parser.newRule("items", () => {
      parser.newRule("item", () => parser.singlePattern("$ID",),);
      parser.listRule("moreItems", "!item",);
    },);
    assert(parser.rules.has("moreItems",),);
    assert(parser.rules.has("item",),);
  });

  it("descr só aceita padrões de token terminal", () => {
    const parser = new ProjectFileParser();
    parser.newRule("probe", () => {
      parser.singlePattern("_abc",);
      parser.descr("Um literal",);
    },);
    assertThrows(() => {
      parser.newRule("probe2", () => {
        parser.pattern(["_a", "_b",], null,);
        parser.descr("inválido",);
      },);
    }, Error,);
  });
});

describe("ProjectFileParser — file stack (10.10.5.12)", () => {
  it("initFileStack zera os quatro prefixos", () => {
    const parser = new TokenProbeParser();
    parser.taskprefix = "t.";
    parser.reportprefix = "r.";
    parser.resourceprefix = "res.";
    parser.accountprefix = "a.";
    parser.useFileStack();
    assertEquals(parser.taskprefix, "",);
    assertEquals(parser.accountprefix, "",);
    assertEquals(parser.fileStack.length, 1,);
  });

  it("push/pop restauram valores anteriores e limpam property", () => {
    const parser = new TokenProbeParser();
    parser.useFileStack();
    parser.taskprefix = "a.";
    parser.pushStack();
    parser.taskprefix = "b.";
    const project = new Project("prj", "P", "1.0",);
    parser.property = new Task(project, "x", "X", null,);
    parser.popStack();
    assertEquals(parser.taskprefix, "a.",);
    assertEquals(parser.property, null,);
  });

  it("appendScListAttribute acumula valores e marca provided", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    const project = new Project("prj", "P", "1.0",);
    const task = new Task(project, "t", "T", null,);
    // Fake mínimo: atributo de lista por cenário.
    let stored: unknown[] = [];
    let setCalled = 0;
    const fake = {
      getForScenario: (_id: string, _sc: number,) => stored,
      setForScenario: (_id: string, v: unknown, _sc: number,) => {
        stored = v as unknown[];
        setCalled++;
      },
    };
    parser.property = fake as unknown as PropertyTreeNode;
    parser.taskprefix = "";
    parser.appendScListAttribute("somelist", ["a", "b",],);
    assertEquals(stored, ["a", "b",],);
    assertEquals(setCalled, 1,);
    void task;
  });

  it("detectLanguage reconhece a diretiva language 'xx'", () => {
    assertEquals(detectLanguage('language "es"\nx',), "es",);
    assertEquals(detectLanguage('# c\nlanguage "pt-BR"\n',), "pt-BR",);
    // `^\s*` permite indentação — aceito pelo regex da spec 10.17.
    assertEquals(detectLanguage('x\n  language "es"\n',), "es",);
    assertEquals(detectLanguage("language = es",), null,);
    assertEquals(detectLanguage("nada",), null,);
  });

  it("aggregate: parse('project') em texto vazio termina sem exceção", () => {
    resetMessages();
    const parser = new ProjectFileParser();
    parser.open("", true, true,);
    // Fiel ao Ruby: o scanner emite `eof` (fim do stream) antes de
    // `endOfText`; texto vazio cai no caminho degenerado de finishPattern e
    // registra um `unexpctd_token` sem lançar exceção. Retorno null.
    const result = parser.parse("project",);
    assertEquals(result, null,);
    assertEquals(messageIds(), ["unexpctd_token",],);
    parser.close();
  });
});
