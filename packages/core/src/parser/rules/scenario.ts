/**
 * TjpSyntaxRules — bloco scenario + apoios (subfase 10.12).
 *
 * Port das regras `scenario*`, `projection*`, `extend*`, `chargeset*`,
 * `limits*`/`limit*`, `flags*`/`flag*`, `fail`/`warn` e `reference*` de
 * `TjpSyntaxRules.rb`. As regras `more*` das listas são geradas por
 * `listRule`/`commaListRule`. `logicalExpression` (fail/warn) pertence ao
 * bloco 4 (10.14) e segue como placeholder até lá.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { AttributeType, } from "../../attributes/attribute-type.ts";
import { ChargeSet, } from "../../finance/charge-set.ts";
import { Limits, } from "../../scheduling/limits.ts";
import { ScoreboardInterval, } from "../../time/scoreboard-interval.ts";
import { TimeInterval, } from "../../time/time-interval.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { Account, } from "../../model/account.ts";
import { Resource, } from "../../model/resource.ts";
import { Scenario, } from "../../model/scenario.ts";
import { Task, } from "../../model/task.ts";
import { AttributeOverwrite, } from "../../model/errors.ts";
import { MessageHandlerInstance, } from "../../message-handler.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { Pattern, } from "../pattern.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** `@property[id, scenarioIdx] = value` ignorando AttributeOverwrite. */
function scSetOverwrite(
  parser: ProjectFileParser,
  id: string,
  value: unknown,
): void {
  try {
    asProp(parser,).setForScenario(id, value, parser.scenarioIdx,);
  } catch (e) {
    if (!(e instanceof AttributeOverwrite)) throw e;
  }
}

/** Lê lista de cenário com fallback []. */
function scList(parser: ProjectFileParser, attrId: string,): unknown[] {
  const prop = parser.property;
  if (!prop) return [];
  try {
    return (prop.getForScenario(attrId, parser.scenarioIdx,) as unknown[]) ??
      [];
  } catch (_e) {
    return [];
  }
}

/**
 * Registra o bloco `extend` de um tipo de atributo: estende o PropertySet e
 * adiciona o padrão dinâmico na regra-alvo (Ruby extendPropertySetDefinition
 * + addPattern nos lambdas de rule_extendAttributes).
 */
function extendAttr(
  parser: ProjectFileParser,
  type: AttributeType,
  defaultValue: unknown,
  valueTokens: string[],
  makeValue: (parser: ProjectFileParser,) => unknown,
): void {
  // Os lambdas dos padrões dinâmicos capturam o id do novo atributo no
  // momento da criação (val[1] do padrão outer) — fiel a Ruby, que usa
  // @val[0] (a keyword) na hora do set.
  const scenarioSpecific = parser.extendPropertySetDefinition(
    type,
    defaultValue,
  );
  const attrIdx = 0;
  const target = scenarioSpecific
    ? parser.ruleToExtendWithScenario
    : parser.ruleToExtend;
  if (!target) return;
  const attrId = String(parser.val[1],);
  target.addPattern(
    new Pattern(
      ["_" + attrId, ...valueTokens,],
      function (this: ProjectFileParser,): unknown {
        const value = makeValue(this,);
        if (scenarioSpecific) {
          asProp(this,).setForScenario(
            attrId,
            value,
            this.scenarioIdx,
          );
        } else {
          asProp(this,).set(attrId, value,);
        }
        return null;
      },
    ),
  );
}

/** Registra o bloco de regras de scenario e apoios. */
export function registerScenarioRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // scenario / header / body / attributes
  // ------------------------------------------------------------------
  rule(p, "scenario", () => {
    p.pattern(
      ["!scenarioHeader", "!scenarioBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "scenario",
      "Scenarios can be used to compare multiple alternative plans or " +
        "track the actual progress of a project.",
    );
  },);

  rule(p, "scenarioAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_active", "!yesNo",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("active", this.val[1],);
        return null;
      },
    );
    p.doc("active", "Enables or disables the scenario.",);

    p.pattern(
      ["_disabled",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("active", false,);
        return null;
      },
    );
    p.level("deprecated",);
    p.also("active",);
    p.doc("disabled", "Deprecated. Use 'active no'.",);

    p.pattern(
      ["_enabled",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("active", true,);
        return null;
      },
    );
    p.level("deprecated",);
    p.also("active",);
    p.doc("enabled", "Deprecated. Use 'active yes'.",);

    p.pattern(["_projection", "!projection",],);
    p.level("deprecated",);
    p.also("booking.task",);
    p.doc("projection", "Deprecated. Use a tracking scenario.",);

    p.pattern(["!scenario",],);
  },);

  rule(p, "scenarioBody", () => {
    p.optionsRule("scenarioAttributes",);
  },);

  rule(p, "scenarioHeader", () => {
    p.pattern(
      ["_scenario", "$ID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        // Cenários precisam vir antes do cenário de tracking (Ruby l.5173).
        for (const scenario of project.scenarios.toArray()) {
          if (scenario.get("projection",)) {
            this.error(
              "scenario_after_tracking",
              "Scenarios must be defined before a tracking scenario is set.",
            );
          }
        }
        if (!this.property) project.scenarios.clearProperties();
        if (project.scenario(String(this.val[1],),)) {
          this.error(
            "scenario_exists",
            `Scenario ${String(this.val[1],)} has already been defined.`,
            this.sourceFileInfo[1] ?? this.getSourceFileInfo()!,
          );
        }
        this.property = new Scenario(
          project,
          String(this.val[1],),
          String(this.val[2],),
          this.property,
        );
        this.property.inheritAttributes();

        if (project.scenarios.toArray().length > 1) {
          MessageHandlerInstance.instance.hideScenario = false;
        }
        return null;
      },
    );
    p.arg(1, "id", "The ID of the scenario.",);
    p.arg(2, "name", "The name of the scenario.",);
  },);

  // ------------------------------------------------------------------
  // projection (deprecated, apontada por scenarioAttributes)
  // ------------------------------------------------------------------
  rule(p, "projection", () => {
    p.optionsRule("projectionAttributes",);
  },);

  rule(p, "projectionAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["_sloppy",], null,);
    p.level("deprecated",);
    p.also("trackingscenario",);
    p.doc("sloppy.projection", "",);

    p.pattern(
      ["_strict",],
      function (this: ProjectFileParser,): unknown {
        this.warning(
          "projection_strict",
          "The strict mode is now always used.",
        );
        return null;
      },
    );
    p.level("deprecated",);
    p.also("trackingscenario",);
    p.doc("strict.projection", "",);
  },);

  // ------------------------------------------------------------------
  // extend (atributos definidos pelo usuário)
  // ------------------------------------------------------------------
  rule(p, "extendAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_date", "!extendId", "$STRING", "!extendOptionsBody",],
      function (this: ProjectFileParser,): unknown {
        extendAttr(
          this,
          AttributeType.Date,
          null,
          ["!date",],
          (pr,) => pr.val[1],
        );
        return null;
      },
    );
    p.arg(
      2,
      "name",
      "The name of the new attribute. It is used as header in report " +
        "columns and the like.",
    );

    p.pattern(
      ["_number", "!extendId", "$STRING", "!extendOptionsBody",],
      function (this: ProjectFileParser,): unknown {
        extendAttr(
          this,
          AttributeType.Float,
          null,
          ["!number",],
          (pr,) => pr.val[1],
        );
        return null;
      },
    );
    p.arg(
      2,
      "name",
      "The name of the new attribute. It is used as header in report " +
        "columns and the like.",
    );

    p.pattern(
      ["_reference", "!extendId", "$STRING", "!extendOptionsBody",],
      function (this: ProjectFileParser,): unknown {
        extendAttr(
          this,
          AttributeType.Reference,
          null,
          ["$STRING", "!referenceBody",],
          (pr,) => [pr.val[1], pr.val[2],],
        );
        return null;
      },
    );
    p.arg(
      2,
      "name",
      "The name of the new attribute. It is used as header in report " +
        "columns and the like.",
    );

    p.pattern(
      ["_richtext", "!extendId", "$STRING", "!extendOptionsBody",],
      function (this: ProjectFileParser,): unknown {
        extendAttr(
          this,
          AttributeType.String,
          null,
          ["$STRING",],
          (pr,) =>
            pr.newRichText(
              String(pr.val[1],),
              pr.sourceFileInfo[1] ?? pr.getSourceFileInfo()!,
            ),
        );
        return null;
      },
    );
    p.arg(
      2,
      "name",
      "The name of the new attribute. It is used as header in report " +
        "columns and the like.",
    );

    p.pattern(
      ["_text", "!extendId", "$STRING", "!extendOptionsBody",],
      function (this: ProjectFileParser,): unknown {
        extendAttr(
          this,
          AttributeType.String,
          null,
          ["$STRING",],
          (pr,) => pr.val[1],
        );
        return null;
      },
    );
    p.arg(
      2,
      "name",
      "The name of the new attribute. It is used as header in report " +
        "columns and the like.",
    );
  },);

  rule(p, "extendOptions", () => {
    p.optional();
    p.repeatable();

    p.singlePattern("_inherit",);
    p.doc(
      "inherit",
      "The attribute value is inherited from the parent property.",
    );

    p.singlePattern("_scenariospecific",);
    p.doc(
      "scenariospecific",
      "The attribute can be defined for each scenario individually.",
    );
  },);

  rule(p, "extendOptionsBody", () => {
    p.optionsRule("extendOptions",);
  },);

  rule(p, "extendId", () => {
    p.pattern(
      ["$ID",],
      function (this: ProjectFileParser,): unknown {
        const id = String(this.val[0],);
        if (!(id[0]! >= "A" && id[0]! <= "Z")) {
          this.error(
            "extend_id_cap",
            "User defined attributes IDs must start with a capital letter",
            this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
          );
        }
        return id;
      },
    );
    p.arg(
      0,
      "id",
      "The ID of the new attribute. It can be used like the built-in IDs.",
    );
  },);

  rule(p, "extendPropertyId", () => {
    p.singlePattern("_task",);
    p.singlePattern("_resource",);
  },);

  // referenceBody dos atributos do tipo reference (extend).
  rule(p, "referenceAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_label", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  },);

  rule(p, "referenceBody", () => {
    p.optionsRule("referenceAttributes",);
  },);

  // ------------------------------------------------------------------
  // chargeset / chargeSetItem
  // ------------------------------------------------------------------
  rule(p, "chargeset", () => {
    p.pattern(
      ["_chargeset", "!chargeSetItem", "!moreChargeSetItems",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("chargeset",);
        type ChargeItem = [Account, number | null,];
        const items: ChargeItem[] = [this.val[1] as ChargeItem,];
        if (this.val[2]) {
          items.push(...(this.val[2] as ChargeItem[]),);
        }
        const chargeSet = new ChargeSet();
        try {
          for (const item of items) {
            chargeSet.addAccount(item[0], item[1],);
          }
          chargeSet.complete();
        } catch (e) {
          this.error(
            "chargeset",
            e instanceof Error ? e.message : String(e,),
            this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
            this.property,
          );
          return null;
        }
        const current = scList(this, "chargeset",);
        const masterAccounts = current
          .map((set,) => (set as ChargeSet).master);
        if (masterAccounts.includes(chargeSet.master,)) {
          this.error(
            "chargeset_master",
            "All charge sets for this property must have different " +
              "top-level accounts.",
            this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
            this.property,
          );
        }
        scSetOverwrite(
          this,
          "chargeset",
          [...current, chargeSet,],
        );
        return null;
      },
    );
    p.doc(
      "chargeset",
      "Distributes the charges of a task or resource over multiple " +
        "accounts.",
    );
  },);

  rule(p, "chargeSetItem", () => {
    p.pattern(
      ["!accountId", "!optionalPercent",],
      function (this: ProjectFileParser,): unknown {
        const prop = this.property;
        let aggregate: string;
        if (prop instanceof Task) {
          aggregate = "tasks";
        } else if (prop instanceof Resource) {
          aggregate = "resources";
        } else {
          throw new Error(`Unknown property type ${prop?.constructor.name}`,);
        }
        const account = this.val[0] as Account;
        if (account.get("aggregate",) !== aggregate) {
          this.error(
            "account_bad_aggregate",
            `The account ${account.fullId} cannot aggregate amounts ` +
              `related to ${aggregate}.`,
          );
        }
        return [account, this.val[1],];
      },
    );
    p.arg(0, "account", "The ID of a previously defined leaf account.",);
    p.arg(1, "share", "A percentage between 0 and 100%",);
  },);

  rule(p, "moreChargeSetItems", () => {
    p.commaListRule("!chargeSetItem",);
  },);

  // ------------------------------------------------------------------
  // limits
  // ------------------------------------------------------------------
  rule(p, "limits", () => {
    p.pattern(
      ["!limitsHeader", "!limitsBody",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "limitsHeader", () => {
    p.pattern(["_limits",], function (this: ProjectFileParser,): unknown {
      this.limits = new Limits();
      if (this.project) this.limits.setProject(this.project,);
      return this.limits;
    },);
  },);

  rule(p, "limitsBody", () => {
    p.optionsRule("limitsAttributes",);
  },);

  const limitKeyword = function (this: ProjectFileParser,): unknown {
    this.setLimit(
      String(this.val[0],),
      this.val[1] as number,
      this.limitInterval ?? undefined,
    );
    return null;
  };
  rule(p, "limitsAttributes", () => {
    p.optional();
    p.repeatable();

    for (
      const kw of [
        "dailymax",
        "dailymin",
        "maximum",
        "minimum",
        "monthlymax",
        "monthlymin",
        "weeklymax",
        "weeklymin",
      ]
    ) {
      p.pattern(["_" + kw, "!limitValue", "!limitAttributes",], limitKeyword,);
      p.doc(kw, "Sets the limit value for this period.",);
    }
    p.doc(
      "limits",
      "Limits the working hours of the resource per day, week or month.",
    );
  },);

  rule(p, "limitAttributes", () => {
    p.optionsRule("limitAttributesBody",);
  },);

  rule(p, "limitAttributesBody", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_end", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        if (this.limitInterval) {
          this.limitInterval.end = this.val[1] as TjTime;
        }
        return null;
      },
    );
    p.doc("end", "The end date of the period the limit applies to.",);

    p.pattern(
      ["_period", "!valInterval",],
      function (this: ProjectFileParser,): unknown {
        const iv = this.val[1] as TimeInterval;
        this.limitInterval = new ScoreboardInterval(
          this.project!.get("start",) as TjTime,
          this.project!.get("scheduleGranularity",) as number,
          iv.start,
          iv.end,
        );
        return null;
      },
    );
    p.doc("period", "The period the limit applies to.",);

    p.pattern(
      ["_resources", "!resourceLeafList",],
      function (this: ProjectFileParser,): unknown {
        this.limitResources = this.val[1] as Resource[];
        return null;
      },
    );
    p.doc(
      "resources",
      "Restricts the limit to the listed resources of the parent " +
        "resource.",
    );

    p.pattern(
      ["_start", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        if (this.limitInterval) {
          this.limitInterval.start = this.val[1] as TjTime;
        }
        return null;
      },
    );
    p.doc("start", "The start date of the period the limit applies to.",);
  },);

  rule(p, "limitValue", () => {
    p.pattern(
      ["!nonZeroWorkingDuration",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        this.limitInterval = new ScoreboardInterval(
          project.get("start",) as TjTime,
          project.get("scheduleGranularity",) as number,
          project.get("start",) as TjTime,
          project.get("end",) as TjTime,
        );
        this.limitResources = [];
        return this.val[0];
      },
    );
  },);

  // ------------------------------------------------------------------
  // flags
  // ------------------------------------------------------------------
  rule(p, "flags", () => {
    p.pattern(
      ["_flags", "!flagList",],
      function (this: ProjectFileParser,): unknown {
        const current = scList(this, "flags",) as string[];
        const added = (this.val[1] as string[]).filter((flag,) =>
          !current.includes(flag,)
        );
        if (added.length > 0) {
          this.appendScListAttribute("flags", added,);
        }
        return null;
      },
    );
    p.doc("flags", "A list of flags assigned to the property.",);
  },);

  rule(p, "flagList", () => {
    p.listRule("moreFlagList", "!flag",);
  },);

  rule(p, "flag", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      const flag = String(this.val[0],);
      const declared = (this.project!.get("flags",) as string[]) ?? [];
      if (!declared.includes(flag,)) {
        this.error(
          "undecl_flag",
          `Undeclared flag '${flag}'`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return flag;
    },);
  },);

  rule(p, "declareFlagList", () => {
    p.listRule("moreDeclareFlagList", "$ID",);
  },);

  // ------------------------------------------------------------------
  // fail / warn (expressões lógicas: bloco 4)
  // ------------------------------------------------------------------
  const failOrWarn = function (this: ProjectFileParser,): unknown {
    const keyword = String(this.val[0],);
    try {
      const prop = asProp(this,);
      prop.set(
        keyword,
        ((prop.get(keyword,) as unknown[]) ?? []).concat([this.val[1],],),
      );
    } catch (e) {
      // Múltiplas condições fail/warn são permitidas (Ruby rescue).
      if (!(e instanceof AttributeOverwrite)) throw e;
    }
    return null;
  };

  rule(p, "fail", () => {
    p.pattern(["_fail", "!logicalExpression",], failOrWarn,);
    p.doc(
      "fail",
      "If the logical expression evaluates to true the task or resource " +
        "is marked as failed.",
    );
  },);

  rule(p, "warn", () => {
    p.pattern(["_warn", "!logicalExpression",], failOrWarn,);
    p.doc(
      "warn",
      "If the logical expression evaluates to true a warning is issued " +
        "for the task or resource.",
    );
  },);

  // projectIDs (apoio à diretiva _projectids do bloco project).
  rule(p, "projectIDs", () => {
    p.pattern(
      ["$ID", "!moreProjectIDs",],
      function (this: ProjectFileParser,): unknown {
        return [String(this.val[0],),].concat(
          (this.val[1] as string[]) ?? [],
        );
      },
    );
  },);

  rule(p, "moreProjectIDs", () => {
    p.commaListRule("$ID",);
  },);
}
