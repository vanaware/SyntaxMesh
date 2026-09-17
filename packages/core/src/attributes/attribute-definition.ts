/**
 * Definição imutável de um atributo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb (arquivo inteiro)
 */

import { AttributeType } from "./attribute-type.ts";
import { TjArgumentError } from "./errors.ts";

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
  readonly isScenarioAttribute: boolean;

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
  ) {
    if (id === null || id === undefined || id === "") {
      throw new TjArgumentError("AttributeDefinition id não pode ser vazio");
    }
    if (name === null || name === undefined || name === "") {
      throw new TjArgumentError("AttributeDefinition name não pode ser vazio");
    }

    this.id = id;
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
    this.userDefined = userDefined;
    this.isList = isList;
    this.isSingleton = isSingleton;
    this.isScenarioAttribute = isScenarioAttribute;

    // @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb:freeze
    Object.freeze(this);
  }

  /**
   * Retorna o construtor correspondente para um tipo de atributo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb:attributeTypeClass
   */
  static attributeTypeClass(type: AttributeType): unknown {
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
        throw new TjArgumentError(`Tipo de atributo desconhecido: ${type}`);
    }
  }
}