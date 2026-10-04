/**
 * Definição imutável de um atributo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb (arquivo inteiro)
 */

import { AttributeType, } from "./attribute-type.ts";
import { TjArgumentError, } from "./errors.ts";
import { AttributeBase, } from "./attribute-base.ts";
import { StringAttribute, } from "./scalar/string-attribute.ts";
import { IntegerAttribute, } from "./scalar/integer-attribute.ts";
import { FloatAttribute, } from "./scalar/float-attribute.ts";
import { BooleanAttribute, } from "./scalar/boolean-attribute.ts";
import { DurationAttribute, } from "./scalar/duration-attribute.ts";
import { DateAttribute, } from "./scalar/date-attribute.ts";
import { SymbolAttribute, } from "./scalar/symbol-attribute.ts";
import { PropertyAttribute, } from "./reference/property-attribute.ts";
import { AccountAttribute, } from "./reference/account-attribute.ts";
import { ReferenceAttribute, } from "./reference/reference-attribute.ts";
import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "./attribute-container.ts";
import { FlagListAttribute, } from "./list/flag-list-attribute.ts";
import { SymbolListAttribute, } from "./list/symbol-list-attribute.ts";
import { ScenarioListAttribute, } from "./list/scenario-list-attribute.ts";
import { NodeListAttribute, } from "./list/node-list-attribute.ts";
import { ResourceListAttribute, } from "./list/resource-list-attribute.ts";
import { TaskListAttribute, } from "./list/task-list-attribute.ts";
import { DependencyListAttribute, } from "./dependency/dependency-list-attribute.ts";
import { TaskDepListAttribute, } from "./dependency/task-dep-list-attribute.ts";
import { ChargeListAttribute, } from "./financial/charge-list-attribute.ts";
import { ChargeSetListAttribute, } from "./financial/charge-set-list-attribute.ts";
import { AccountCreditListAttribute, } from "./financial/account-credit-list-attribute.ts";
import { AllocationAttribute, } from "./allocation/allocation-attribute.ts";
import { BookingListAttribute, } from "./allocation/booking-list-attribute.ts";
import { LogicalExpressionAttribute, } from "./logical/logical-expression-attribute.ts";
import { LogicalExpressionListAttribute, } from "./logical/logical-expression-list-attribute.ts";
import { TimeIntervalListAttribute, } from "./time-interval/time-interval-list-attribute.ts";
import { LeaveListAttribute, } from "./time-interval/leave-list-attribute.ts";
import { LeaveAllowanceListAttribute, } from "./time-interval/leave-allowance-list-attribute.ts";
import { LimitsAttribute, } from "./time-interval/limits-attribute.ts";
import { ShiftAssignmentsAttribute, } from "./time-interval/shift-assignments-attribute.ts";
import { WorkingHoursAttribute, } from "./time-interval/working-hours-attribute.ts";
import { RealFormatAttribute, } from "./format/real-format-attribute.ts";
import { ColumnListAttribute, } from "./format/column-list-attribute.ts";
import { FormatListAttribute, } from "./format/format-list-attribute.ts";
import { SortListAttribute, } from "./format/sort-list-attribute.ts";
import { JournalSortListAttribute, } from "./format/journal-sort-list-attribute.ts";
import { RichTextAttribute, } from "./rich/rich-text-attribute.ts";
import { DefinitionListAttribute, } from "./rich/definition-list-attribute.ts";

/**
 * Definição de um atributo — blueprint imutável.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb
 */
export class AttributeDefinition<T> {
  /**
   * ID do atributo (ex: "effort", "responsible").
   */
  readonly id: string;

  /**
   * Nome amigável do atributo.
   */
  readonly name: string;

  /**
   * Tipo do atributo.
   */
  readonly type: AttributeType;

  /**
   * Valor padrão do atributo.
   */
  readonly defaultValue: T;

  /**
   * Se o atributo é definido pelo usuário (vs. pelo sistema).
   */
  readonly userDefined: boolean;

  /**
   * Se o atributo é uma lista.
   */
  readonly isList: boolean;

  /**
   * Se o atributo é um singleton (apenas um valor).
   */
  readonly isSingleton: boolean;

  /**
   * Se o atributo é de escopo de cenário.
   */
  isScenarioAttribute: boolean;

  /**
   * Construtor da classe de atributo correspondente (ex: StringAttribute).
   * Usado em `new aType.objClass(propertySet, aType, this)`.
   */
  objClass: new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;

  /**
   * Se o atributo é herdado do pai (não-scenario ou scenario-specific).
   */
  inheritedFromParent: boolean;

  /**
   * Se o atributo é herdado do projeto (top-level).
   */
  inheritedFromProject: boolean;

  /**
   * Constrói uma definição de atributo.
   *
   * @param id - ID do atributo
   * @param name - Nome amigável
   * @param type - Tipo do atributo
   * @param defaultValue - Valor padrão
   * @param userDefined - Se é definido pelo usuário
   * @param isList - Se é uma lista
   * @param isSingleton - Se é singleton
   * @param isScenarioAttribute - Se é de escopo de cenário
   * @param inheritedFromParent - Se o atributo é herdado do pai
   * @param inheritedFromProject - Se o atributo é herdado do projeto
   */
  constructor(
    id: string,
    name: string,
    type: AttributeType,
    defaultValue: T,
    userDefined: boolean = false,
    isList: boolean = false,
    isSingleton: boolean = false,
    isScenarioAttribute: boolean = false,
    inheritedFromParent: boolean = false,
    inheritedFromProject: boolean = false,
  ) {
    if (id === null || id === undefined || id === "") {
      throw new TjArgumentError("AttributeDefinition id não pode ser vazio",);
    }
    if (name === null || name === undefined || name === "") {
      throw new TjArgumentError("AttributeDefinition name não pode ser vazio",);
    }

    this.id = id;
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
    this.userDefined = userDefined;
    this.isList = isList;
    this.isSingleton = isSingleton;
    this.isScenarioAttribute = isScenarioAttribute;
    this.objClass = AttributeDefinition.getObjClass(type);
    this.inheritedFromParent = inheritedFromParent;
    this.inheritedFromProject = inheritedFromProject;

    // @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb:freeze
    Object.freeze(this);
  }

  /**
   * Retorna o construtor correspondente para um tipo de atributo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb:attributeTypeClass
   */
  static attributeTypeClass(type: AttributeType,): unknown {
    switch (type) {
      case AttributeType.String:
        return "StringAttribute";
      case AttributeType.Integer:
        return "IntegerAttribute";
      case AttributeType.Float:
        return "FloatAttribute";
      case AttributeType.Boolean:
        return "BooleanAttribute";
      case AttributeType.Symbol:
        return "SymbolAttribute";
      case AttributeType.Date:
        return "DateAttribute";
      case AttributeType.Duration:
        return "DurationAttribute";
      case AttributeType.Property:
        return "PropertyAttribute";
      case AttributeType.Account:
        return "AccountAttribute";
      case AttributeType.Reference:
        return "ReferenceAttribute";
      case AttributeType.FlagList:
        return "FlagListAttribute";
      case AttributeType.SymbolList:
        return "SymbolListAttribute";
      case AttributeType.ScenarioList:
        return "ScenarioListAttribute";
      case AttributeType.NodeList:
        return "NodeListAttribute";
      case AttributeType.ResourceList:
        return "ResourceListAttribute";
      case AttributeType.TaskList:
        return "TaskListAttribute";
      case AttributeType.DependencyList:
        return "DependencyListAttribute";
      case AttributeType.TaskDepList:
        return "TaskDepListAttribute";
      case AttributeType.ChargeList:
        return "ChargeListAttribute";
      case AttributeType.ChargeSetList:
        return "ChargeSetListAttribute";
      case AttributeType.AccountCreditList:
        return "AccountCreditListAttribute";
      case AttributeType.Allocation:
        return "AllocationAttribute";
      case AttributeType.BookingList:
        return "BookingListAttribute";
      case AttributeType.LogicalExpression:
        return "LogicalExpressionAttribute";
      case AttributeType.LogicalExpressionList:
        return "LogicalExpressionListAttribute";
      case AttributeType.TimeIntervalList:
        return "TimeIntervalListAttribute";
      case AttributeType.LeaveList:
        return "LeaveListAttribute";
      case AttributeType.LeaveAllowanceList:
        return "LeaveAllowanceListAttribute";
      case AttributeType.Limits:
        return "LimitsAttribute";
      case AttributeType.ShiftAssignments:
        return "ShiftAssignmentsAttribute";
      case AttributeType.WorkingHours:
        return "WorkingHoursAttribute";
      case AttributeType.RealFormat:
        return "RealFormatAttribute";
      case AttributeType.ColumnList:
        return "ColumnListAttribute";
      case AttributeType.FormatList:
        return "FormatListAttribute";
      case AttributeType.SortList:
        return "SortListAttribute";
      case AttributeType.JournalSortList:
        return "JournalSortListAttribute";
      case AttributeType.RichText:
        return "RichTextAttribute";
      case AttributeType.DefinitionList:
        return "DefinitionListAttribute";
      default:
        throw new TjArgumentError(`Tipo de atributo desconhecido: ${type}`,);
    }
  }

  static getObjClass(type: AttributeType): new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any> {
    switch (type) {
      case AttributeType.String:
        return StringAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Integer:
        return IntegerAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Float:
        return FloatAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Boolean:
        return BooleanAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Symbol:
        return SymbolAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Date:
        return DateAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Duration:
        return DurationAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Property:
        return PropertyAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Account:
        return AccountAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Reference:
        return ReferenceAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.FlagList:
        return FlagListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.SymbolList:
        return SymbolListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ScenarioList:
        return ScenarioListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.NodeList:
        return NodeListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ResourceList:
        return ResourceListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.TaskList:
        return TaskListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.DependencyList:
        return DependencyListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.TaskDepList:
        return TaskDepListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ChargeList:
        return ChargeListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ChargeSetList:
        return ChargeSetListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.AccountCreditList:
        return AccountCreditListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Allocation:
        return AllocationAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.BookingList:
        return BookingListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.LogicalExpression:
        return LogicalExpressionAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.LogicalExpressionList:
        return LogicalExpressionListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.TimeIntervalList:
        return TimeIntervalListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.LeaveList:
        return LeaveListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.LeaveAllowanceList:
        return LeaveAllowanceListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.Limits:
        return LimitsAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ShiftAssignments:
        return ShiftAssignmentsAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.WorkingHours:
        return WorkingHoursAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.RealFormat:
        return RealFormatAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.ColumnList:
        return ColumnListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.FormatList:
        return FormatListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.SortList:
        return SortListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.JournalSortList:
        return JournalSortListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.RichText:
        return RichTextAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      case AttributeType.DefinitionList:
        return DefinitionListAttribute as unknown as new (property: PropertyLike, type: AttributeDefinition<unknown>, container: AttributeContainer) => AttributeBase<any>;
      default:
        throw new TjArgumentError(`Tipo de atributo desconhecido: ${type}`,);
    }
  }
}

export { AttributeType };
