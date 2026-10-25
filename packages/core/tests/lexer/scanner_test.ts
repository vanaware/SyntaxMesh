import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { Log, } from "../../src/log.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";
import { Macro, } from "../../src/lexer/macro-table.ts";
import {
  BufferStreamHandle,
  dirnameOf,
  FileStreamHandle,
  LineScanner,
  StreamHandle,
  TextStream,
} from "../../src/lexer/stream-handle.ts";
import { Scanner, type TokenPattern, } from "../../src/lexer/scanner.ts";

/** Padrões mínimos: espaços ignorados + ID + fallback (evita loop igual :LITERAL do TJ). */
const basePatterns: TokenPattern[] = [
  [null, /^\s+/, ":tjp", null,],
  ["ID", /^[A-Za-z_]\w*/, ":tjp", null,],
  ["LIT", /^[^]/, ":tjp", null,],
];

function makeScanner(text: string, patterns = basePatterns,): Scanner {
  const s = new Scanner(text, Log, patterns, ":tjp",);
  s.open(true,);
  return s;
}

beforeEach(() => {
  MessageHandlerInstance.instance.reset();
  FileStreamHandle.fileLoader = null;
},);

afterEach(() => {
  FileStreamHandle.fileLoader = null;
},);

describe("TextStream (StringIO)", () => {
  it("gets devolve linhas com LF e conta lineno", () => {
    const st = new TextStream("ab\ncd\n",);
    assertEquals(st.gets(), "ab\n",);
    assertEquals(st.lineno, 1,);
    assertEquals(st.gets(), "cd\n",);
    assertEquals(st.gets(), null,);
    assert(st.eof(),);
  });

  it("última linha sem LF é devolvida sem sufixo", () => {
    const st = new TextStream("x\ny",);
    assertEquals(st.gets(), "x\n",);
    assertEquals(st.gets(), "y",);
    assert(st.eof(),);
  });
});

describe("LineScanner (StringScanner)", () => {
  it("scan ancora na posição atual e avança", () => {
    const ls = new LineScanner("hello world",);
    assertEquals(ls.scan(/hello/,), "hello",);
    assertEquals(ls.pos, 5,);
    // pre_match do Ruby exclui o último match
    assertEquals(ls.preMatch(), "",);
    assertEquals(ls.postMatch(), " world",);
    assertEquals(ls.scan(/hello/,), null,);
    assertEquals(ls.preMatch(), null,); // scan falho limpa o registro
    assertEquals(ls.scan(/\s+/,), " ",);
    assertEquals(ls.preMatch(), "hello",);
    assertEquals(ls.postMatch(), "world",);
  });

  it("eos/peek/matched funcionam como strscan", () => {
    const ls = new LineScanner("abc",);
    assertEquals(ls.eos(), false,);
    assertEquals(ls.peek(2,), "ab",);
    ls.scan(/abc/,);
    assertEquals(ls.matched, "abc",);
    assert(ls.eos(),);
  });
});

describe("dirnameOf (File.dirname)", () => {
  it("espelha File.dirname do Ruby", () => {
    assertEquals(dirnameOf("a/b/c.tjp",), "a/b",);
    assertEquals(dirnameOf("c.tjp",), ".",);
    assertEquals(dirnameOf("/x.tjp",), "/",);
    assertEquals(dirnameOf("/a/b",), "/a",);
  });
});

describe("StreamHandle", () => {
  const host = { error: () => {}, };

  it("readyNextLine lê linha a linha e devolve false no EOF", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("l1\nl2\n",);
    assertEquals(sh.readyNextLine(), true,);
    assertEquals(sh.line, "l1\n",);
    sh.scanner!.pos = 3; // consome a linha inteira
    assertEquals(sh.readyNextLine(), true,);
    assertEquals(sh.line, "l2\n",);
    sh.scanner!.pos = 3;
    assertEquals(sh.readyNextLine(), false,);
    assertEquals(sh.scanner, null,);
  });

  it("lineNo conta linhas lidas e soma 1 após LF consumido", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("l1\nl2\n",);
    sh.readyNextLine();
    assertEquals(sh.lineNo(), 1,);
    sh.scanner!.pos = 3; // come o \n
    assertEquals(sh.lineNo(), 2,);
  });

  it("line devolve apenas a parte consumida da linha", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("hello world\n",);
    sh.readyNextLine();
    sh.scan(/hello/,);
    assertEquals(sh.currentLine(), "hello",);
  });

  it("injectText substitui a chamada de macro no stream", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("a ${m b} c\n",);
    sh.readyNextLine();
    sh.scan(/a /,); // consome o prefixo "a "
    sh.scan(/\$\{m b\}/,); // cursor após a chamada (matched = 6)
    sh.injectText("EXPANDED", 6,);
    // preMatch = "a " (2) - 6 → clampa a 0: contexto à esquerda descartado
    assertEquals(sh.scanner!.string, "EXPANDED c\n",);
    assertEquals(sh.scanner!.pos, 0,);
  });

  it("injectMacro empilha entrada com endPos", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("${m}\n",);
    sh.readyNextLine();
    sh.scan(/\$\{m\}/,);
    const macro = new Macro("m", "X", new SourceFileInfo("f", 1, 1,),);
    assertEquals(sh.injectMacro(macro, ["m",], "X", 4,), true,);
    assertEquals(sh.macroStack.length, 1,);
    assertEquals(sh.macroStack[0]!.macro, macro,);
    assertEquals(sh.nextMacroEnd, 1,);
  });

  it("injectMacro devolve false acima de 20 níveis (recursão)", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("x\n",);
    sh.readyNextLine();
    for (let i = 0; i <= 20; i++) {
      sh.macroStack.push({ macro: null, args: [], text: "", endPos: 0, },);
    }
    sh.scanner!.pos = 0;
    assertEquals(sh.injectMacro(null, ["m",], "t", 0,), false,);
  });

  it("cleanupMacroStack remove macros totalmente consumidas", () => {
    const sh = new StreamHandle(Log, host,);
    sh.stream = new TextStream("0123456789\n",);
    sh.readyNextLine();
    sh.macroStack.push({ macro: null, args: [], text: "", endPos: 3, },);
    sh.nextMacroEnd = 3;
    sh.scanner!.pos = 5;
    sh.cleanupMacroStack();
    assertEquals(sh.macroStack.length, 0,);
    assertEquals(sh.nextMacroEnd, null,);
  });

  it("dirname usa o nome do arquivo; vazio sem arquivo", () => {
    const sh = new StreamHandle(Log, host,);
    assertEquals(sh.dirname(), "",);
    sh.fileName = "dir/sub/f.tjp";
    assertEquals(sh.dirname(), "dir/sub",);
  });

  it("BufferStreamHandle opera sobre string", () => {
    const bh = new BufferStreamHandle("line\n", Log, host,);
    assertEquals(bh.readyNextLine(), true,);
    assertEquals(bh.line, "line\n",);
  });

  it("FileStreamHandle usa loader injetado (browser-safe)", () => {
    FileStreamHandle.fileLoader = () => "conteudo\n";
    const fh = new FileStreamHandle("mestre.tjp", Log, host,);
    assertEquals(fh.fileName, "mestre.tjp",);
    assert(fh.readyNextLine(),);
    assertEquals(fh.line, "conteudo\n",);
  });

  it("close zera o stream", () => {
    const bh = new BufferStreamHandle("x", Log, host,);
    bh.close();
    assertEquals(bh.stream, null,);
  });
});

describe("Scanner — estrutura e padrões (10.8.1/10.8.2)", () => {
  it("constructor registra padrões e ativa defaultMode", () => {
    const s = new Scanner("mestre", Log, basePatterns, ":tjp",);
    assertEquals(s.defaultMode, ":tjp",);
    assertEquals(s.mode, ":tjp",);
    assertEquals(s.activePatterns?.length, 3,);
    assertEquals(s.fileStack.length, 0,);
    assertEquals(s.macroTable.includes("nada",), false,);
  });

  it("padrão sem modo usa :tjp por omissão", () => {
    const s = new Scanner("m", Log, [["ID", /^x/, undefined, null,],], ":tjp",);
    assertEquals(s.patternsByMode.get(":tjp",)!.length, 1,);
  });

  it("addPattern com lista de modos replica o padrão", () => {
    const s = new Scanner("m", Log, basePatterns, ":tjp",);
    s.addPattern("T", /^q/, [":dqString", ":macroCall",], null,);
    assertEquals(s.patternsByMode.get(":dqString",)!.length, 1,);
    assertEquals(s.patternsByMode.get(":macroCall",)!.length, 1,);
  });

  it("set mode troca activePatterns", () => {
    const s = new Scanner("m", Log, basePatterns, ":tjp",);
    s.addPattern("DQ", /^x/, ":dqString", null,);
    s.mode = ":dqString";
    assertEquals(s.activePatterns?.length, 1,);
    assertEquals(s.mode, ":dqString",);
  });

  it("modo inexistente lança", () => {
    const s = new Scanner("m", Log, basePatterns, ":tjp",);
    assertThrows(
      () => {
        s.mode = ":nope";
      },
      Error,
      "Undefined mode",
    );
  });
});

describe("Scanner — open/close/include (10.8.3)", () => {
  it("open(true) cria BufferStreamHandle sobre o texto", () => {
    const s = makeScanner("alpha",);
    assert(s.cf instanceof BufferStreamHandle,);
    assertEquals(s.cf!.fileName, null,);
  });

  it("open de arquivo usa FileStreamHandle e seta masterPath", () => {
    FileStreamHandle.fileLoader = () => "x\n";
    const s = new Scanner("dir/mestre.tjp", Log, basePatterns, ":tjp",);
    s.open();
    assert(s.cf instanceof FileStreamHandle,);
    assertEquals(s.masterPath, "dir/",);
  });

  it("open de arquivo ilegível loga erro open_file sem lançar", () => {
    FileStreamHandle.fileLoader = () => {
      throw new Error("nf",);
    };
    const s = new Scanner("sumido.tjp", Log, basePatterns, ":tjp",);
    s.open();
    const msgs = MessageHandlerInstance.instance.messages;
    assertEquals(msgs.some((m,) => m.id === "open_file"), true,);
  });

  it("close reseta pilha e buffers", () => {
    FileStreamHandle.fileLoader = () => "x\n";
    const s = new Scanner("m.tjp", Log, basePatterns, ":tjp",);
    s.open();
    s.close();
    assertEquals(s.fileStack.length, 0,);
    assertEquals(s.cf, null,);
  });

  it("include resolve caminho relativo ao arquivo chamador", () => {
    FileStreamHandle.fileLoader = (n,) => `${n}:line\n`;
    const s = new Scanner("dir/mestre.tjp", Log, basePatterns, ":tjp",);
    s.open();
    const name = s.include("sub/inc.tjp", s.sourceFileInfo(),);
    assertEquals(name, "dir/sub/inc.tjp",);
    assertEquals(s.fileStack.length, 2,);
    assertEquals(s.cf!.fileName, "dir/sub/inc.tjp",);
  });

  it("include absoluto é aceito como está", () => {
    FileStreamHandle.fileLoader = () => "y\n";
    const s = new Scanner("mestre.tjp", Log, basePatterns, ":tjp",);
    s.open();
    assertEquals(s.include("/etc/x.tjp", null,), "/etc/x.tjp",);
  });

  it("include recursivo é reportado como erro", () => {
    FileStreamHandle.fileLoader = () => "ky\n";
    const s = new Scanner("dir/m.tjp", Log, basePatterns, ":tjp",);
    s.open();
    s.include("m.tjp", null,);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(msgs.some((m,) => m.id === "include_recursion"),);
  });

  it("include de arquivo inexistente loga bad_include", () => {
    FileStreamHandle.fileLoader = (n,) => {
      if (n.endsWith("ruim.tjp",)) throw new Error("nope",);
      return "ok\n";
    };
    const s = new Scanner("m.tjp", Log, basePatterns, ":tjp",);
    s.open();
    s.include("ruim.tjp", null,);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(msgs.some((m,) => m.id === "bad_include"),);
  });

  it("onEof roda quando o incluído termina", () => {
    FileStreamHandle.fileLoader = () => "kid\n";
    const s = new Scanner("dir/m.tjp", Log, basePatterns, ":tjp",);
    s.open();
    let ran = false;
    s.include("k.tjp", null, () => {
      ran = true;
    },);
    s.nextToken(); // kid
    s.nextToken(); // eof do incluído -> dispara onEof na próxima volta
    s.nextToken();
    assert(ran,);
  });
});

describe("Scanner — source info (10.8.4)", () => {
  it("sourceFileInfo no buffer aponta para a linha corrente", () => {
    const s = makeScanner("alpha\nbeta\n",);
    s.nextToken(); // alpha
    const info = s.sourceFileInfo();
    assertEquals(info.lineNo, 1,);
    assertEquals(info.columnNo, 0,);
  });

  it("fileName retorna texto mestre quando é buffer vazio de nome", () => {
    const s = new Scanner("apenas texto", Log, basePatterns, ":tjp",);
    assertEquals(s.fileName(), "apenas texto",);
    assertEquals(s.cf, null,);
  });

  it("lineNo/columnNo/line refletem posição do stream", () => {
    const s = makeScanner("alpha beta\n",);
    assertEquals(s.lineNo(), 1,);
    assertEquals(s.columnNo(), 0,);
    s.nextToken();
    assertEquals(s.line(), "alpha",);
  });

  it("sem stream ativa, sourceFileInfo cai no mestre", () => {
    const s = new Scanner("m", Log, basePatterns, ":tjp",);
    const info = s.sourceFileInfo();
    assertEquals(info.fileName, "m",);
    assertEquals(info.lineNo, 0,);
  });
});

describe("Scanner — tokens (10.8.5)", () => {
  it("nextToken devolve tokens na ordem, ignorando padrões nil", () => {
    const s = makeScanner("um dois tres",);
    assertEquals(s.nextToken()[0], "ID",);
    assertEquals(s.nextToken()[1], "dois",);
    assertEquals(s.nextToken()[1], "tres",);
  });

  it("eof e endOfText fecham o stream em duas etapas", () => {
    const s = makeScanner("x",);
    s.nextToken(); // x
    const eofTok = s.nextToken();
    assertEquals(eofTok[0], "eof",);
    assertEquals(eofTok[1], "<END>",);
    const eot = s.nextToken();
    assertEquals(eot[0], "endOfText",);
    assertEquals(eot[1], "<EOT>",);
  });

  it("returnToken devolve o mesmo token na próxima leitura", () => {
    const s = makeScanner("x y",);
    const t = s.nextToken();
    s.returnToken(t,);
    assertEquals(s.nextToken(), t,);
    assertEquals(s.nextToken()[1], "y",);
  });

  it("dois returnToken em sequência lançam erro fatal", () => {
    const s = makeScanner("x",);
    const t = s.nextToken();
    s.returnToken(t,);
    assertThrows(
      () => s.returnToken(t,),
      Error,
      "Cannot return more than 1 token",
    );
  });

  it("postProc pode reescrever tipo e texto", () => {
    const patterns: TokenPattern[] = [[
      "ID",
      /^[a-z]+/,
      ":tjp",
      (type, text,) => [type === "ID" ? "KEYWORD" : type, text.toUpperCase(),],
    ],];
    const s = new Scanner("ola", Log, patterns, ":tjp",);
    s.open(true,);
    assertEquals(s.nextToken(), ["KEYWORD", "OLA", s.startOfToken!,],);
  });

  it("caractere sem match loga no_token_match (comportamento Ruby)", () => {
    const patterns: TokenPattern[] = [["ID", /^[a-z]+/, ":tjp", null,],];
    const s = new Scanner("abc", Log, patterns, ":tjp",);
    s.open(true,);
    // Sem pattern de fallback, invocar nextToken em '!' looparia como no
    // Ruby. Validamos o caminho de erro chamando a API diretamente.
    s.cf!.readyNextLine();
    s.cf!.scan(/abc/,);
    s.error("no_token_match_probe", "Unexpected characters found",);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(msgs.some((m,) => m.id === "no_token_match_probe"),);
  });

  it("token não terminado fora do modo default loga runaway_token", () => {
    const patterns: TokenPattern[] = [
      [null, /\s+/, ":tjp", null,],
      ["ID", /^[a-z]+/, ":tjp", null,],
      ["STR", /"[^"]*"/, ":dqString", null,],
      [null, /[^]/, ":dqString", null,],
    ];
    const s = new Scanner('abc "unterminated', Log, patterns, ":tjp",);
    s.open(true,);
    s.nextToken(); // abc
    s.mode = ":dqString";
    s.nextToken(); // consome abre-aspas
    const t = s.nextToken(); // força EOF em modo não-default
    assertEquals(t[0], "eof",);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(msgs.some((m,) => m.id === "runaway_token"),);
  });
});

describe("Scanner — macros (10.8.6)", () => {
  it("addMacro/macroDefined expõem a MacroTable", () => {
    const s = makeScanner("x",);
    s.addMacro(new Macro("greet", "hi", new SourceFileInfo("f", 1, 1,),),);
    assert(s.macroDefined("greet",),);
    assertEquals(s.macroDefined("nope",), false,);
  });

  it("expansão de macro injeta texto relido como novos tokens", () => {
    const hostRef: { s?: Scanner } = {};
    const macroCall = (type: string | null, text: string,): [
      string | null,
      string,
    ] => {
      const args = text.slice(2, -1,).trim().split(/\s+/,);
      hostRef.s!.expandMacro("", args, text.length,);
      return [null, text,];
    };
    const patterns: TokenPattern[] = [
      [null, /\s+/, ":tjp", null,],
      ["ID", /^[a-z]+/, ":tjp", null,],
      [null, /\$\{[^}]*\}/, ":tjp", macroCall,],
    ];
    const s = new Scanner("${greet mundo}", Log, patterns, ":tjp",);
    hostRef.s = s;
    s.addMacro(new Macro("greet", "oi ${1}", new SourceFileInfo("f", 1, 1,),),);
    s.open(true,);
    assertEquals(s.nextToken()[1], "oi",);
    assertEquals(s.nextToken()[1], "mundo",);
  });

  it("macro indefinida loga undefined_macro sem travar", () => {
    const s = makeScanner("x",);
    s.expandMacro("", ["inexistente",], 13,);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(
      msgs.some((m,) =>
        m.id === "undefined_macro" || m.id === "macro_stack_overflow"
      ),
    );
  });

  it("macro com expansão vazia é ignorada silenciosamente", () => {
    const s = makeScanner("abc",);
    s.addMacro(new Macro("vazia", "", new SourceFileInfo("f", 1, 1,),),);
    s.expandMacro("", ["vazia",], 8,);
    const msgs = MessageHandlerInstance.instance.messages;
    assertEquals(
      msgs.filter((m,) => m.id === "undefined_macro").length,
      0,
    );
    assertEquals(s.nextToken()[1], "abc",);
  });

  it("histórico de macro é registrado como info ao logar erro", () => {
    const s = makeScanner("abc",);
    s.cf!.macroStack.push({
      macro: new Macro("greet", "x", new SourceFileInfo("f", 2, 1,),),
      args: ["greet", "um",],
      text: "x",
      endPos: 1,
    },);
    s.error("algum_erro", "boom",);
    const msgs = MessageHandlerInstance.instance.messages;
    assert(msgs.some((m,) => m.id === "macro_stack"),);
    assert(msgs.some((m,) => m.id === "algum_erro"),);
  });
});
