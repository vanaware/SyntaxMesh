/**
 * TjpSyntaxRules — bloco 4a: lógica (subfase 10.14.4).
 *
 * Port das regras `logicalExpression` / `operation` / `operand` / `operator`
 * / `argument*` e das variantes `flag*` de `TjpSyntaxRules.rb`. O parser
 * constrói árvores `LogicalExpression`/`LogicalOperation` com folhas
 * `LogicalAttribute`/`LogicalFlag`/`LogicalFunction`; a avaliação (eval) e a
 * validação de aridade das funções chegam na Fase 11.
 *
 * `functions`/`functionsBody`/`functionPatterns` não são usadas pelo parser —
 * existem só para documentação (como no Ruby).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import {
  LogicalAttribute,
  LogicalExpression,
  LogicalFlag,
  LogicalFunction,
  LogicalOperation,
} from "../../logical/logical-expression.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

/** Valor de `sourceFileInfo` do Ruby (SFI do primeiro token do padrão). */
const curSfi = (p: ProjectFileParser,) => p.sourceFileInfo[0] ?? null;

/** Flags declaradas no projeto (Ruby `@project['flags']`). */
const projectFlags = (p: ProjectFileParser,): string[] =>
  (p.project?.get("flags",) as string[] | undefined) ?? [];

/** Registra o bloco de regras de expressões lógicas. */
export function registerLogicRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // logicalExpression / operation / operand / operator (10.14.4.1-2)
  // ------------------------------------------------------------------
  rule(p, "logicalExpression", () => {
    p.pattern(["!operation",], function (this: ProjectFileParser,): unknown {
      return new LogicalExpression(
        this.val[0] as LogicalOperation,
        curSfi(this,),
      );
    },);
    p.pattern(
      ["_@", "!allOrNone",],
      function (this: ProjectFileParser,): unknown {
        return new LogicalExpression(
          new LogicalOperation(this.val[1],),
          curSfi(this,),
        );
      },
    );
  },);

  rule(p, "operation", () => {
    p.pattern(["!operand", "!operationChain",], function (
      this: ProjectFileParser,
    ): unknown {
      let operation = new LogicalOperation(this.val[0],);
      const chain = this.val[1] as Array<[string, unknown,]> | null;
      if (chain) {
        for (const ops of chain) {
          operation = new LogicalOperation(operation,);
          operation.operator = ops[0];
          operation.operand2 = ops[1];
        }
      }
      return operation;
    },);
  },);

  rule(p, "operationChain", () => {
    p.optional();
    p.repeatable();
    p.pattern(
      ["!operatorAndOperand",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "operatorAndOperand", () => {
    p.pattern(
      ["!operator", "!operand",],
      function (this: ProjectFileParser,): unknown {
        return [this.val[0], this.val[1],];
      },
    );
  },);

  rule(p, "operator", () => {
    p.singlePattern("_|",);
    p.doc("operator", "The 'or' operator",);
    p.singlePattern("_&",);
    p.singlePattern("_>",);
    p.singlePattern("_<",);
    p.singlePattern("_=",);
    p.singlePattern("_>=",);
    p.singlePattern("_<=",);
    p.singlePattern("_!=",);
  },);

  rule(p, "operand", () => {
    p.pattern(
      ["_(", "!operation", "_)",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
    p.pattern(
      ["_~", "!operand",],
      function (this: ProjectFileParser,): unknown {
        const operation = new LogicalOperation(this.val[1],);
        operation.operator = "~";
        return operation;
      },
    );

    p.pattern(["$ABSOLUTE_ID",], function (this: ProjectFileParser,): unknown {
      const raw = String(this.val[0],);
      if ((raw.match(/\./g,) ?? []).length > 1) {
        this.error(
          "operand_attribute",
          "Attributes must be specified as <scenarioID>.<attribute>",
          curSfi(this,),
        );
      }
      const [scenario, attribute,] = raw.split(".",);
      const scenarioIdx = this.project!.scenarioIdx(scenario!,);
      if (scenarioIdx === undefined) {
        this.error(
          "operand_unkn_scen",
          `Unknown scenario ID ${scenario}`,
          curSfi(this,),
        );
      }
      return new LogicalAttribute(
        attribute ?? scenario!,
        // scenarioIdx já validado acima (erro se undefined); cenário 0 existe.
        this.project!.scenario(scenarioIdx ?? 0,)!,
      );
    },);

    p.pattern(["!date",], function (this: ProjectFileParser,): unknown {
      return new LogicalOperation(this.val[0],);
    },);

    p.pattern(["$ID", "!argumentList",], function (
      this: ProjectFileParser,
    ): unknown {
      const args = this.val[1] as unknown[] | null | undefined;
      if (!Array.isArray(args,)) {
        if (!projectFlags(this,).includes(String(this.val[0],),)) {
          this.error(
            "operand_unkn_flag",
            `Undeclared flag '${String(this.val[0],)}'`,
            curSfi(this,),
          );
        }
        return new LogicalFlag(String(this.val[0],),);
      }
      const func = new LogicalFunction(String(this.val[0],),);
      func.setArguments(args,);
      return func;
    },);

    p.pattern(["$INTEGER",], function (this: ProjectFileParser,): unknown {
      return new LogicalOperation(this.val[0],);
    },);
    p.pattern(["$FLOAT",], function (this: ProjectFileParser,): unknown {
      return new LogicalOperation(this.val[0],);
    },);
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return new LogicalOperation(this.val[0],);
    },);
  },);

  // ------------------------------------------------------------------
  // argument / argumentList / argumentListBody / moreArguments (10.14.4.4)
  // ------------------------------------------------------------------
  rule(p, "argument", () => {
    p.singlePattern("$ABSOLUTE_ID",);
    p.singlePattern("!date",);
    p.singlePattern("$ID",);
    p.singlePattern("$INTEGER",);
    p.singlePattern("$FLOAT",);
  },);

  rule(p, "argumentList", () => {
    p.optional();
    p.pattern(["_(", "!argumentListBody", "_)",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[1] ?? [];
    },);
  },);

  rule(p, "argumentListBody", () => {
    p.optional();
    p.pattern(["!argument", "!moreArguments",], function (
      this: ProjectFileParser,
    ): unknown {
      const rest = this.val[1] as unknown[] | null;
      return [this.val[0],].concat(rest ?? [],);
    },);
  },);

  rule(p, "moreArguments", () => {
    p.commaListRule("!argument",);
  },);

  // ------------------------------------------------------------------
  // flagLogicalExpression + variantes flag* (10.14.4.5)
  // ------------------------------------------------------------------
  rule(p, "flagLogicalExpression", () => {
    p.pattern(
      ["!flagOperation",],
      function (this: ProjectFileParser,): unknown {
        return new LogicalExpression(
          this.val[0] as LogicalOperation,
          curSfi(this,),
        );
      },
    );
  },);

  rule(p, "flagOperation", () => {
    p.pattern(["!flagOperand", "!flagOperationChain",], function (
      this: ProjectFileParser,
    ): unknown {
      let operation = new LogicalOperation(this.val[0],);
      const chain = this.val[1] as Array<[string, unknown,]> | null;
      if (chain) {
        for (const ops of chain) {
          operation = new LogicalOperation(operation,);
          operation.operator = ops[0];
          operation.operand2 = ops[1];
        }
      }
      return operation;
    },);
  },);

  rule(p, "flagOperationChain", () => {
    p.optional();
    p.repeatable();
    p.pattern(["!flagOperatorAndOperand",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[0];
    },);
  },);

  rule(p, "flagOperatorAndOperand", () => {
    p.pattern(["!flagOperator", "!flagOperand",], function (
      this: ProjectFileParser,
    ): unknown {
      return [this.val[0], this.val[1],];
    },);
  },);

  rule(p, "flagOperator", () => {
    p.singlePattern("_|",);
    p.singlePattern("_&",);
  },);

  rule(p, "flagOperand", () => {
    p.pattern(["_(", "!flagOperation", "_)",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[1];
    },);
    p.pattern(
      ["_~", "!flagOperand",],
      function (this: ProjectFileParser,): unknown {
        const operation = new LogicalOperation(this.val[1],);
        operation.operator = "~";
        return operation;
      },
    );
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      if (!projectFlags(this,).includes(String(this.val[0],),)) {
        this.error(
          "operand_unkn_flag",
          `Undeclared flag '${String(this.val[0],)}'`,
          curSfi(this,),
        );
      }
      return new LogicalFlag(String(this.val[0],),);
    },);
  },);

  // ------------------------------------------------------------------
  // functions / functionsBody / functionPatterns (10.14.4.3 — doc only)
  // ------------------------------------------------------------------
  rule(p, "functions", () => {
    p.pattern(["!functionsBody",],);
  },);

  rule(p, "functionsBody", () => {
    p.optionsRule("functionPatterns",);
  },);

  rule(p, "functionPatterns", () => {
    // Regras apenas para documentação (não usadas pelo parser).
    p.pattern(["_hasalert", "_(", "$INTEGER", "_,", "!date", "_)",],);
    p.pattern(["_isactive", "_(", "$ID", "_)",],);
    p.pattern(["_ischildof", "_(", "$ID", "_)",],);
    p.pattern([
      "_isdependencyof",
      "_(",
      "$ID",
      "_,",
      "$ID",
      "_,",
      "$INTEGER",
      "_)",
    ],);
    p.pattern(["_isdutyof", "_(", "$ID", "_,", "$ID", "_)",],);
    p.pattern(["_isfeatureof", "_(", "$ID", "_,", "$ID", "_)",],);
    p.pattern(["_isleaf", "_(", "_)",],);
    p.pattern(["_ismilestone", "_(", "$ID", "_)",],);
    p.pattern(["_isongoing", "_(", "$ID", "_)",],);
    p.pattern(["_isresource", "_(", "_)",],);
    p.pattern(["_isresponsibilityof", "_(", "$ID", "_,", "$ID", "_)",],);
    p.pattern(["_istask", "_(", "_)",],);
    p.pattern(["_isvalid", "_(", "$ID", "_)",],);
    p.pattern(["_treelevel", "_(", "_)",],);
  },);
}
