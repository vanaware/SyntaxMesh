import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { Log, } from "../../src/log.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileScanner, } from "../../src/lexer/project-file-scanner.ts";
import { Macro, } from "../../src/lexer/macro-table.ts";
import { LanguageRegistry, } from "../../src/i18n/registry.ts";
import { en, } from "../../src/i18n/en.ts";
import { ptBR, } from "../../src/i18n/pt-BR.ts";
import type { ScannerToken, } from "../../src/lexer/scanner.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

/** Cria scanner sobre buffer de texto e acumula todos os tokens. */
function scanAll(
  text: string,
  language = "en",
  registry?: LanguageRegistry,
): ScannerToken[] {
  const scanner = new ProjectFileScanner(
    text + "\n",
    Log,
    language,
    registry,
  );
  scanner.open(true,);
  const tokens: ScannerToken[] = [];
  for (;;) {
    const t = scanner.nextToken();
    if (t[0] === "eof" || t[0] === "endOfText") break;
    // Zera o SourceFileInfo para facilitar as comparações.
    tokens.push([t[0], t[1], null,],);
  }
  return tokens;
}

function types(text: string, language = "en",): string[] {
  return scanAll(text, language,).map((t,) => t[0]);
}

function texts(text: string, language = "en",): unknown[] {
  return scanAll(text, language,).map((t,) => t[1]);
}

/**
 * Escaneia registrando as MACROs encontradas (papel do parser no Ruby:
 * rule_macro chama scanner.addMacro). Tokens MACRO não viram saída.
 */
function scanWithMacros(text: string,): ScannerToken[] {
  const scanner = new ProjectFileScanner(text, Log,);
  scanner.open(true,);
  const out: ScannerToken[] = [];
  for (;;) {
    const t = scanner.nextToken();
    if (t[0] === "eof" || t[0] === "endOfText") break;
    if (t[0] === "MACRO") {
      const body = String(t[1],).trim();
      const space = body.indexOf(" ",);
      const name = space < 0 ? body : body.slice(0, space,);
      let value = space < 0 ? "" : body.slice(space + 1,);
      // O parser (rule_macro) removeria as aspas do valor; aqui manual.
      if (value.startsWith('"',) && value.endsWith('"',)) {
        value = value.slice(1, -1,);
      }
      scanner.addMacro(
        new Macro(name, value, t[2] ?? scanner.sourceFileInfo(),),
      );
      continue;
    }
    out.push([t[0], t[1], null,],);
  }
  return out;
}

describe("ProjectFileScanner (10.9)", () => {
  // ---- 10.9.1 padrões ----

  it("10.9.1.3 espaços e comentários # viram nada", () => {
    assertEquals(scanAll("   \n",), [],);
    assertEquals(scanAll("# um comentário\ntask",), [["ID", "task", null,],],);
  });

  it("10.9.1.3 comentário // de linha única", () => {
    assertEquals(texts("// aaa\neffort",), ["effort",],);
  });

  it("10.9.1.3 comentário /* */ de linha única e multi-linha", () => {
    assertEquals(texts("/* x */ task",), ["task",],);
    assertEquals(
      texts("/* linha1\nlinha2\n*/ task",),
      ["task",],
    );
  });

  it("10.9.1.4 chamada de macro ${...} expande", () => {
    const tokens = scanWithMacros(
      '[ macrohello "hello world" ]\ntask ${macrohello}\n',
    );
    assertEquals(tokens.map((t,) => t[1]), ["task", "hello", "world",],);
  });

  it('10.9.1.4 macro com argumento ${name "arg"}', () => {
    const out = scanWithMacros(
      '[ greet "hello ${1}" ]\ntask ${greet "Bob"}\n',
    );
    assertEquals(out.map((t,) => String(t[1],)), ["task", "hello", "Bob",],);
  });

  it("10.9.1.4 variável de ambiente $(VAR) injeta valor", () => {
    const saved = ProjectFileScanner.envProvider;
    ProjectFileScanner.envProvider = (name,) =>
      name === "MYTESTVAR" ? "xyz" : null;
    try {
      assertEquals(texts("foo$(MYTESTVAR)bar",), ["fooxyzbar",],);
      assertEquals(texts("$(MYTESTVAR)",), ["xyz",],);
      // Desconhecida: erro unknown_env_var, sem token.
      MessageHandlerInstance.instance.messages.length = 0;
      assertEquals(scanAll("$(NOPE_NOT_SET)",), [],);
      const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
      assert(ids.includes("unknown_env_var",),);
    } finally {
      ProjectFileScanner.envProvider = saved;
    }
  });

  it("10.9.1.5 ID_WITH_COLON 'foo:' chopa o dois-pontos", () => {
    assertEquals(scanAll("foo:",), [["ID_WITH_COLON", "foo", null,],],);
  });

  it("10.9.1.5 ABSOLUTE_ID a.b.c", () => {
    assertEquals(scanAll("a.b.c",), [["ABSOLUTE_ID", "a.b.c", null,],],);
    assertEquals(scanAll("dep.p1.t1",), [[
      "ABSOLUTE_ID",
      "dep.p1.t1",
      null,
    ],],);
  });

  it("10.9.1.5 ID simples (com unicode acentuado)", () => {
    assertEquals(scanAll("bar",), [["ID", "bar", null,],],);
    assertEquals(scanAll("esforço",), [
      ["ID", "esforço", null,],
    ],);
  });

  it("10.9.1.6 DATE vira TjTime", () => {
    const t = scanAll("2026-01-31",)[0]!;
    assertEquals(t[0], "DATE",);
    assert(t[1] instanceof TjTime,);
  });

  it("10.9.1.6 TIME 'hh:mm' vira segundos", () => {
    assertEquals(scanAll("8:30",), [["TIME", 8 * 3600 + 30 * 60, null,],],);
  });

  it("10.9.1.6 data inválida gera erro time_error", () => {
    MessageHandlerInstance.instance.messages.length = 0;
    scanAll("2026-13-45",);
    const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
    assert(ids.includes("time_error",),);
  });

  it("10.9.1.7 FLOAT e INTEGER viram números", () => {
    assertEquals(scanAll("3.14",), [["FLOAT", 3.14, null,],],);
    assertEquals(scanAll("42",), [["INTEGER", 42, null,],],);
    assertEquals(types(".5 6",), ["FLOAT", "INTEGER",],);
  });

  it("10.9.1.8 string duplas multi-linha com escape", () => {
    assertEquals(texts('"ola mundo"',), ["ola mundo",],);
    assertEquals(texts('"say \\"hi\\""',), ['say "hi"',],);
    assertEquals(texts('"linha1\nlinha2\n"',), ["linha1\nlinha2\n",],);
  });

  it("10.9.1.8 string simples", () => {
    // 'it''s ok' = duas strings adjacentes (Ruby fecha no segundo quote)
    assertEquals(texts("'it''s ok'",), ["it", "s ok",],);
  });

  it("10.9.1.8 string tesoura -8<- ... ->8-", () => {
    // A indentação líder é removida das linhas do corpo.
    const src = "-8<-\n  hello\n  world\n  ->8-\n";
    assertEquals(texts(src,), ["hello\nworld\n",],);
  });

  it("10.9.1.8 string tesoura vazia", () => {
    assertEquals(texts("-8<-\n  ->8-\n",), ["",],);
  });

  it("10.9.1.9 MACRO de linha única [ ... ]", () => {
    assertEquals(scanAll("[ mymacro some text ]\n",), [
      ["MACRO", " mymacro some text ", null,],
    ],);
  });

  it("10.9.1.9 MACRO multi-linha", () => {
    assertEquals(texts("[ mymacro\n  line2\n]\n",), [" mymacro\n  line2\n",],);
  });

  it("10.9.1.10 literais multi-char e single-char", () => {
    assertEquals(types("<= >= != < > = !",), [
      "LITERAL",
      "LITERAL",
      "LITERAL",
      "LITERAL",
      "LITERAL",
      "LITERAL",
      "LITERAL",
    ],);
    assertEquals(texts("<=",), ["<=",],);
    assertEquals(texts("{ }",), ["{", "}",],);
  });

  // ---- 10.9.2 modos ----

  it("10.9.2.2 macro dentro de string dupla expande", () => {
    const out = scanWithMacros('[ mname "WORLD" ]\n"hello ${mname}"\n',);
    assertEquals(out, [["STRING", "hello WORLD", null,],],);
  });

  it("10.9.2.3/10.9.2.4 modos retornam ao :tjp após fim", () => {
    const scanner = new ProjectFileScanner('"abc"\n', Log,);
    scanner.open(true,);
    assertEquals(scanner.mode, ":tjp",);
    scanner.nextToken();
    assertEquals(scanner.mode, ":tjp",);
  });

  it("10.9.2.4 token não terminado dentro de string gera runaway_token", () => {
    MessageHandlerInstance.instance.messages.length = 0;
    const toks = scanAll('"abacaba sem fim',);
    const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
    assert(ids.includes("runaway_token",),);
    // scanAll para no 'eof'; o erro é a evidência.
    assertEquals(toks.length, 0,);
  });

  // ---- 10.9.3 i18n ----

  it("10.9.3.1 pt-BR: sinônimos ID são normalizados", () => {
    assertEquals(texts("tarefa", "pt-BR",), ["task",],);
    assertEquals(texts("esforço", "pt-BR",), ["effort",],);
  });

  it("10.9.3.1 inglês permanece canônico em pt-BR (fallback)", () => {
    assertEquals(texts("task", "pt-BR",), ["task",],);
    assertEquals(texts("effort", "pt-BR",), ["effort",],);
  });

  it("10.9.3.1 es: sinônimos normalizados", () => {
    assertEquals(texts("tarea", "es",), ["task",],);
    assertEquals(texts("proyecto", "es",), ["project",],);
  });

  it("10.9.3.1 palavra não keyword NÃO é traduzida", () => {
    assertEquals(texts("banana", "pt-BR",), ["banana",],);
    // IDs preservados: 'recurso' é keyword, mas 'recursofulano' não é
    assertEquals(texts("recursofulano", "pt-BR",), ["recursofulano",],);
  });

  it("10.9.3.1 idioma desconhecido: nada é traduzido", () => {
    assertEquals(texts("tarefa", "de",), ["tarefa",],);
  });

  it("10.9.3.2 tipo do token normalizado permanece ID", () => {
    const t = scanAll("tarefa", "pt-BR",)[0]!;
    assertEquals(t[0], "ID",);
    assertEquals(t[1], "task",);
  });

  it("10.9.3.2 registry isolado sem pt-BR não traduz", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptBR,);
    const scanner = new ProjectFileScanner("tarefa\n", Log, "xx", reg,);
    scanner.open(true,);
    const t = scanner.nextToken();
    assertEquals(t[1], "tarefa",);
  });
});

describe("C3.8 scanner — keywords novas tokenizam sem novos modos", () => {
  // Fase 10 Complemento C3.8.1: asserir que as keywords novas (material,
  // picture, format, timebasis, breakdownreport, rdoreport) tokenizam como
  // `ID` canônico (o scanner não precisa de novos estados/modos). Aliases
  // pt-BR/es normalizam para a forma canônica.
  const newKeywords = [
    "material",
    "picture",
    "format",
    "timebasis",
    "breakdownreport",
    "rdoreport",
    "caption",
    "align",
    "alt",
    "markdown",
    "richtext",
  ];
  for (const kw of newKeywords) {
    it(`en: '${kw}' tokeniza como ID canônico`, () => {
      const t = scanAll(kw, "en",)[0]!;
      assertEquals(t[0], "ID",);
      assertEquals(t[1], kw,);
    });
  }
  it("pt-BR: 'base_temporal' → canônico 'timebasis'", () => {
    assertEquals(texts("base_temporal", "pt-BR",), ["timebasis",],);
  });
  it("pt-BR: 'tratrabalhado' → canônico 'working'", () => {
    assertEquals(texts("tratrabalhado", "pt-BR",), ["working",],);
  });
  it("es: 'base_temporal' → canônico 'timebasis'", () => {
    assertEquals(texts("base_temporal", "es",), ["timebasis",],);
  });
});
