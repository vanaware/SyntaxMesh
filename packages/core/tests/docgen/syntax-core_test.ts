/**
 * Testes do `SyntaxCore` — dados de highlight compartilhados (22.1b.6.1–6.8).
 *
 * Port da lógica de coleta/classificação de `KateSyntax.rb`/`VimSyntax.rb`;
 * os geradores finais `.xml`/`.vim` seguem cancelados (16.15, ADR 035).
 *
 * ⚠️ ADAPTAÇÃO: a gramática portada não tem option blocks com vários nomes,
 * nem atributos cujos nomes atinjam os `STOP_NAMES` no meio da caminhada, e
 * `resourcereport`/`taskreport`/`textreport` não são keywords documentadas —
 * essas regras são exercitadas com fixtures sintéticas (6.2/6.5).
 * `task.timesheet` (foldable no Ruby) não existe na gramática portada; o
 * fold de propriedades cobre o caminho equivalente.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KateSyntax.rb
 * @see docs/taskjuggler/lib/taskjuggler/VimSyntax.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco H
 */
import { assert, assertEquals, } from "@std/assert";
import { before, describe, it, } from "@std/testing/bdd";
import {
  KeywordDocumentation,
  normalize,
  SyntaxCore,
  SyntaxReference,
} from "../../src/docgen/mod.ts";
import type { TokenRule, } from "../../src/docgen/mod.ts";
import { Pattern, } from "../../src/parser/pattern.ts";

describe("SyntaxCore (22.1b.6)", () => {
  // A construção é cara (tabelas do parser + cross-reference); uma por suite.
  let reference: SyntaxReference;
  let core: SyntaxCore;
  before(() => {
    reference = new SyntaxReference(null, true,);
    core = new SyntaxCore(reference,);
  },);

  describe("coleções (22.1b.6.1)", () => {
    it("properties contém exatamente as keywords com isProperty()", () => {
      const expected = [...reference.keywords.values(),].filter(
        (kwd,) => kwd.isProperty(),
      );
      assertEquals(core.properties, expected,);
      assert(core.properties.includes(reference.keywords.get("task",)!,),);
    });

    it("attributes é o complemento de properties na referência", () => {
      const expected = [...reference.keywords.values(),].filter(
        (kwd,) => !kwd.isProperty(),
      );
      assertEquals(core.attributes, expected,);
      assert(core.attributes.includes(reference.keywords.get("depends",)!,),);
      assertEquals(
        core.properties.length + core.attributes.length,
        reference.keywords.size,
      );
    });

    it("optionBlocks contém as keywords com atributos opcionais", () => {
      const expected = [...reference.keywords.values(),].filter(
        (kwd,) => kwd.optionalAttributes.length > 0,
      );
      assertEquals(core.optionBlocks, expected,);
      assert(core.optionBlocks.includes(reference.keywords.get("project",)!,),);
      assert(
        !core.optionBlocks.includes(reference.keywords.get("priority",)!,),
      );
    });
  });

  describe("keywordList (22.1b.6.2)", () => {
    it("união sem duplicatas, na ordem das coleções", () => {
      const names = core.keywordList();
      assertEquals(names.length, new Set(names,).size,);
      assertEquals(names.length, 127,);
      // Ordem: nomes das propriedades antes dos nomes dos atributos.
      const taskIndex = names.indexOf("task",);
      const dependsIndex = names.indexOf("depends",);
      assert(taskIndex >= 0 && dependsIndex >= 0,);
      assert(taskIndex < dependsIndex,);
    });

    it("ignora os nomes 'supplement' das propriedades", () => {
      const supplementTask = reference.keywords.get("supplement.task",)!;
      assertEquals(supplementTask.names, ["supplement",],);
      assert(core.properties.includes(supplementTask,),);
      assert(!core.keywordList().includes("supplement",),);
    });

    it("pula resourcereport/taskreport/textreport (fixture sintética)", () => {
      // Os três reports não são keywords documentadas na gramática portada e,
      // no Ruby, são propriedades (REPORT_PROPERTY_KEYWORDS) — o filtro de
      // atributos é defensivo nos dois lados. A fixture força o caminho de
      // atributos via override de isProperty() para exercitar o filtro.
      class SyntheticAttribute extends KeywordDocumentation {
        override isProperty(): boolean {
          return false;
        }
      }
      const injected = new SyntaxReference(null, true,);
      for (const skipped of ["resourcereport", "taskreport", "textreport",]) {
        const pattern = new Pattern([],);
        pattern.keyword = skipped;
        const doc = new SyntheticAttribute(
          reference.keywords.get("depends",)!.rule,
          pattern,
          skipped,
          [],
          new Map(),
        );
        doc.names = [skipped,];
        injected.keywords.set(skipped, doc,);
      }
      const names = new SyntaxCore(injected,).keywordList();
      for (const skipped of ["resourcereport", "taskreport", "textreport",]) {
        assert(!names.includes(skipped,), `${skipped} fora da lista`,);
      }
      // Controle: um atributo sintético comum entra.
      assert(names.includes("depends",),);
      // Regressão: na gramática real os reports nem existem como keywords.
      const real = core.keywordList();
      for (const skipped of ["resourcereport", "taskreport", "textreport",]) {
        assert(!real.includes(skipped,),);
      }
    });

    it("break nos STOP_NAMES (fixture sintética)", () => {
      // Nenhum atributo real atinge um STOP_NAME no meio dos nomes.
      const pattern = new Pattern([],);
      pattern.keyword = "synthetic";
      const doc = new KeywordDocumentation(
        reference.keywords.get("depends",)!.rule,
        pattern,
        "synthetic",
        [],
        new Map(),
      );
      doc.names = ["effort", "supplement", "extra",];
      const injected = new SyntaxReference(null, true,);
      injected.keywords.set("synthetic", doc,);
      const names = new SyntaxCore(injected,).keywordList();
      assert(names.includes("effort",),);
      assert(!names.includes("extra",), "o break corta o resto da caminhada",);
    });

    it("nomes de propriedades entram mesmo com STOP_NAME adiante (continue)", () => {
      // O filtro de supplement nas propriedades é `continue`, não `break`:
      // uma propriedade sintética com nomes após 'supplement' mantém o resto.
      const pattern = new Pattern([],);
      pattern.keyword = "syntheticprop";
      const doc = new KeywordDocumentation(
        reference.keywords.get("task",)!.rule,
        pattern,
        "syntheticprop",
        [],
        new Map(),
      );
      doc.names = ["supplement", "kept",];
      // isProperty() exige optionalAttributes.includes(this).
      doc.optionalAttributes.push(doc,);
      const injected = new SyntaxReference(null, true,);
      injected.keywords.set("syntheticprop", doc,);
      const names = new SyntaxCore(injected,).keywordList();
      assert(!names.includes("supplement",),);
      assert(names.includes("kept",),);
    });
  });

  describe("categories (22.1b.6.3)", () => {
    it("as três listas com o conteúdo esperado", () => {
      const categories = core.categories();
      // ⚠️ ADAPTAÇÃO: o trio fixo do Vim normaliza o quinteto duplicado do Kate.
      assertEquals(categories.keywords, ["macro", "project", "supplement",],);
      for (const name of ["task", "resource", "account",]) {
        assert(categories.builtin.includes(name,), `builtin tem ${name}`,);
      }
      for (const name of ["depends", "allocate", "effort",]) {
        assert(categories.types.includes(name,), `types tem ${name}`,);
      }
    });

    it("builtin não contém 'supplement'", () => {
      assert(!core.categories().builtin.includes("supplement",),);
    });

    it("types aplica os filtros de atributos", () => {
      const types = core.categories().types;
      for (const skipped of ["resourcereport", "taskreport", "textreport",]) {
        assert(!types.includes(skipped,), `${skipped} fora de types`,);
      }
      // include.project/include.macro só têm o nome 'include' (STOP_NAME).
      assert(!types.includes("include",),);
    });
  });

  describe("tokenRules (22.1b.6.4)", () => {
    it("contagem e ordem fiéis ao context Normal do Kate", () => {
      const rules = core.tokenRules();
      assertEquals(rules.length, 20,);
      assertEquals(
        rules.map((rule,) => rule.attribute),
        [
          "Date",
          "Time",
          "Duration",
          "Builtin Function",
          "Keyword",
          "Data Types",
          "Include",
          "Arguments",
          "Symbol",
          "Symbol",
          "Symbol",
          "Symbol",
          "Float",
          "Decimal",
          "String",
          "String",
          "String",
          "Comment",
          "Comment",
          "Comment",
        ],
      );
    });

    it("famílias regexp/keywords com os padrões originais", () => {
      const rules = core.tokenRules();
      const regexps = rules.filter(
        (rule,): rule is Extract<TokenRule, { kind: "regexp" }> =>
          rule.kind === "regexp",
      );
      assertEquals(regexps.length, 5,);
      assertEquals(regexps[0]!.pattern, "\\d{4}-\\d{2}-\\d{2}\\S*",);
      // ⚠️ ADAPTAÇÃO: o typo `\d{1-2}` do Kate vira `\d{1,2}`.
      assertEquals(regexps[1]!.pattern, "\\d{1,2}:\\d{2}(:\\d{2}|)",);
      assertEquals(regexps[2]!.pattern, "\\d(min|h|d|w|m|y)",);
      assertEquals(regexps[3]!.pattern, "include.*$",);
      assertEquals(regexps[4]!.pattern, "\\{.*}$",);
      const keywordRules = rules.filter((rule,) => rule.kind === "keywords");
      assertEquals(
        keywordRules.map((rule,) =>
          rule.kind === "keywords" ? rule.list : null
        ),
        ["builtin", "keywords", "types",],
      );
    });

    it("famílias char/number com regions e sufixos", () => {
      const rules = core.tokenRules();
      const chars = rules.filter(
        (rule,): rule is Extract<TokenRule, { kind: "char" }> =>
          rule.kind === "char",
      );
      assertEquals(chars.length, 4,);
      assertEquals(
        chars.map((
          rule,
        ) => [rule.char, rule.region?.name, rule.region?.edge,]),
        [
          ["{", "Brace2", "begin",],
          ["}", "Brace2", "end",],
          ["[", "Brace1", "begin",],
          ["]", "Brace1", "end",],
        ],
      );
      const numbers = rules.filter(
        (rule,): rule is Extract<TokenRule, { kind: "number" }> =>
          rule.kind === "number",
      );
      assertEquals(numbers.length, 2,);
      assertEquals(numbers[0]!.float, true,);
      assertEquals(numbers[0]!.suffixes, ["f", "F",],);
      assertEquals(numbers[1]!.float, false,);
      assertEquals(
        numbers[1]!.suffixes,
        ["ULL", "LUL", "LLU", "UL", "LU", "LL", "U", "L",],
      );
    });

    it("famílias string/comment com aberturas e fechamentos", () => {
      const rules = core.tokenRules();
      const strings = rules.filter(
        (rule,): rule is Extract<TokenRule, { kind: "string" }> =>
          rule.kind === "string",
      );
      assertEquals(
        strings.map((rule,) => [rule.open, rule.close,]),
        [["'", "'",], ['"', '"',], ["-8<-", "->8-",],],
      );
      const comments = rules.filter(
        (rule,): rule is Extract<TokenRule, { kind: "comment" }> =>
          rule.kind === "comment",
      );
      assertEquals(
        comments.map((rule,) => [rule.open, rule.close,]),
        [["#", null,], ["//", null,], ["/*", "*/",],],
      );
    });
  });

  describe("optionBlockRegions (22.1b.6.5)", () => {
    it("nome único: id normalizado sem sufixo (single)", () => {
      const regions = core.optionBlockRegions();
      const depends = regions.find((region,) =>
        region.name === "tjpblk_depends"
      )!;
      assert(depends !== undefined,);
      assertEquals(depends.tag, "depends",);
      assertEquals(depends.startPattern, "^\\s*depends\\s.*{\\s*$",);
      assertEquals(depends.endPattern, "^\\s*}\\s*$",);
      assertEquals(depends.contains[0], "@tjpcommon",);
      assertEquals(depends.contains[1], "tjp_depends",);
    });

    it("vários nomes: sufixo _name por região (fixture sintética)", () => {
      // A gramática portada não tem option blocks multi-nome.
      const task = reference.keywords.get("task",)!;
      const pattern = new Pattern([],);
      pattern.keyword = "syntheticmulti";
      const doc = new KeywordDocumentation(
        task.rule,
        pattern,
        "syntheticmulti",
        [],
        new Map(),
      );
      doc.names = ["alpha", "beta",];
      doc.optionalAttributes.push(task,);
      const injected = new SyntaxReference(null, true,);
      injected.keywords.set("syntheticmulti", doc,);
      const regions = new SyntaxCore(injected,).optionBlockRegions().filter(
        (region,) => region.name.startsWith("tjpblk_syntheticmulti",),
      );
      assertEquals(regions.length, 2,);
      // Multi-nome: o sufixo _name vale para TODOS os nomes (VimSyntax.rb:102).
      assertEquals(regions[0]!.name, "tjpblk_syntheticmulti_alpha",);
      assertEquals(regions[0]!.tag, "alpha",);
      assertEquals(regions[1]!.name, "tjpblk_syntheticmulti_beta",);
      assertEquals(regions[1]!.tag, "beta",);
    });

    it("supplement: tag com pontos virando espaços e tjp_supplement", () => {
      const regions = core.optionBlockRegions();
      const supplement = regions.find(
        (region,) => region.name === "tjpblk_supplement_task",
      )!;
      assert(supplement !== undefined,);
      assertEquals(supplement.tag, "supplement task",);
      assertEquals(
        supplement.startPattern,
        "^\\s*supplement task\\s.*{\\s*$",
      );
      assertEquals(
        supplement.contains[supplement.contains.length - 1],
        "tjp_supplement",
      );
    });

    it("fold para propriedades; atributos comuns não dobram", () => {
      const regions = core.optionBlockRegions();
      const byName = new Map(regions.map((region,) => [region.name, region,]),);
      for (const name of ["project", "task", "resource", "account",]) {
        assert(byName.get(`tjpblk_${name}`,)!.fold, `${name} dobra`,);
      }
      // task.timesheet não existe na gramática portada; o caminho de
      // propriedades cobre o fold (⚠️ ADAPTAÇÃO documentada no cabeçalho).
      for (const name of ["depends", "allocate", "journalentry",]) {
        assert(!byName.get(`tjpblk_${name}`,)!.fold, `${name} não dobra`,);
      }
    });

    it("contained quando !globalScope(); project fica livre", () => {
      const regions = core.optionBlockRegions();
      const byName = new Map(regions.map((region,) => [region.name, region,]),);
      assert(byName.get("tjpblk_task",)!.contained,);
      assert(byName.get("tjpblk_depends",)!.contained,);
      assert(!byName.get("tjpblk_project",)!.contained,);
    });

    it("contains de aninhamento e normalização de pontos", () => {
      const regions = core.optionBlockRegions();
      const byName = new Map(regions.map((region,) => [region.name, region,]),);
      // journalentry tem picture como opcional, e picture tem opcionais
      // próprios: entram o tjp_ e o tjpblk_ (bloco e não-bloco).
      const journal = byName.get("tjpblk_journalentry",)!;
      assert(journal.contains.includes("tjp_picture",),);
      assert(journal.contains.includes("tjpblk_picture",),);
      // limits.task: o ponto do keyword vira underscore no id.
      const limits = byName.get("tjpblk_limits_task",)!;
      assert(limits !== undefined,);
      assertEquals(limits.tag, "limits",);
      assert(limits.contains.includes("tjp_limits_task",),);
    });
  });

  describe("indentSettings (22.1b.6.6)", () => {
    it("cinwords em ordem alfabética", () => {
      const cinwords = core.indentSettings().cinwords;
      assertEquals(cinwords, [...cinwords,].sort(),);
    });

    it("cinwords únicos e iguais à união dos nomes dos option blocks", () => {
      const cinwords = core.indentSettings().cinwords;
      assertEquals(cinwords.length, new Set(cinwords,).size,);
      const union = new Set(
        core.optionBlocks.flatMap((kwd,) => kwd.names),
      );
      assertEquals(new Set(cinwords,), union,);
      // 'supplement' aparece em supplement.task e supplement.resource: uma vez.
      assertEquals(
        cinwords.filter((name,) => name === "supplement").length,
        1,
      );
    });

    it("valores literais do setlocal do Vim", () => {
      const settings = core.indentSettings();
      assertEquals(settings.softtabstop, 2,);
      assertEquals(settings.shiftwidth, 2,);
      assertEquals(settings.tabstop, 2,);
      assertEquals(settings.expandtab, true,);
      assertEquals(settings.cinoptions, "g0,t0,+0,(0,c0,C1,n-2",);
      assertEquals(settings.cinkeys, "0{,0},!^F,o,O",);
    });
  });

  describe("normalize (22.1b.6.7)", () => {
    it("pontos viram underscores", () => {
      assertEquals(normalize("limits.allocate",), "limits_allocate",);
      assertEquals(
        normalize("booking.charge.material",),
        "booking_charge_material",
      );
    });

    it("sem pontos, a string fica intacta", () => {
      assertEquals(normalize("task",), "task",);
      assertEquals(normalize("",), "",);
    });
  });

  it("paridade estrutural com os geradores Ruby (22.1b.6.8)", () => {
    const categories = core.categories();
    for (const name of ["task", "resource", "account",]) {
      assert(categories.builtin.includes(name,), `builtin tem ${name}`,);
    }
    assert(!categories.types.includes("resourcereport",),);
    const lineHashComments = core.tokenRules().filter(
      (rule,) =>
        rule.kind === "comment" && rule.open === "#" &&
        rule.close === null,
    );
    assertEquals(lineHashComments.length, 1,);
  });
});
