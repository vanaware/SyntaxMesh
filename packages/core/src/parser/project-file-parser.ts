/**
 * ProjectFileParser — especialização do TextParser para arquivos TJP.
 *
 * Port de `ProjectFileParser.rb` (arquivo inteiro). Fornece os campos de
 * estado, `open`/`close`, delegação de tokens, macros globais e as funções
 * de convenção usadas pelas regras de sintaxe (`TjpSyntaxRules`, subfases
 * 10.11–10.14).
 *
 * Extensão SyntaxMesh (ADR 023, subfase 10.17): `open` detecta a diretiva
 * `language "xx"` no arquivo mestre e cria o ProjectFileScanner no idioma
 * correspondente; o parser em si permanece agnóstico de idioma (keywords
 * canônicas).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ProjectFileParser.rb
 */
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeOverwrite, } from "../model/errors.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { globalRegistry, LanguageRegistry, } from "../i18n/mod.ts";
import { loadFileText, type LogLike, } from "../lexer/stream-handle.ts";
import { Macro, } from "../lexer/macro-table.ts";
import { ProjectFileScanner, } from "../lexer/project-file-scanner.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { Limits, } from "../scheduling/limits.ts";
import type { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import { PropertySet, } from "../model/property-set.ts";
import { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { Project, } from "../model/project.ts";
import { Report, } from "../model/report.ts";
import { Resource, } from "../model/resource.ts";
import { Task, } from "../model/task.ts";
import {
  type RichTextFactory,
  RichTextFactoryImpl,
} from "../richtext/factory.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import type { Rule, } from "./rule.ts";
import { TokenDoc, } from "../lexer/token-doc.ts";
import { type ParserToken, TextParser, } from "./text-parser.ts";
import { registerTjpRules, } from "./rules/mod.ts";

/** LogLike no-op — o core não depende do Log concreto do app. */
const NULL_LOG: LogLike = {
  msg: () => {},
  activity: () => {},
  startProgressMeter: () => {},
  stopProgressMeter: () => {},
};

/**
 * Diretiva `language "pt-BR"` (subfase 10.17). Retorna o código do idioma
 * ou null quando ausente.
 */
export function detectLanguage(content: string,): string | null {
  const m = content.match(/^\s*language\s+"([^"]+)"/m,);
  return m ? m[1]! : null;
}

export class ProjectFileParser extends TextParser {
  /** Projeto em processamento (Ruby @project). */
  project: Project | null = null;
  /**
   * Fábrica de RichText injetada (Fase 12.18). Quando ausente, `newRichText`
   * cria uma {@link RichTextFactoryImpl} sob demanda com o projeto corrente.
   */
  richTextFactory: RichTextFactory | null = null;
  /** Propriedade-alvo dos atributos em processamento (Ruby @property). */
  property: PropertyTreeNode | null = null;
  /** Índice do cenário corrente (Ruby @scenarioIdx). */
  scenarioIdx = 0;
  /** Pilha de propriedades p/ 'supplement' aninhado (Ruby @idStack). */
  idStack: Array<PropertyTreeNode | null> = [];

  /** Variáveis com escopo de arquivo (Ruby @fileStackVariables). */
  fileStackVariables: string[] = [];
  /** Pilha de escopo de arquivo (Ruby @fileStack). */
  fileStack: Array<Record<string, string>> = [];

  // Prefixos herdados dos arquivos incluídos (Ruby @taskprefix etc.).
  taskprefix = "";
  reportprefix = "";
  resourceprefix = "";
  accountprefix = "";

  // Estado de atributos em processamento (usado pelas regras 10.11+).
  allocate: unknown = null;
  booking: unknown = null;
  journalEntry: unknown = null;
  /** Picture em processamento (Fase 10 Complemento C3.3). */
  picture: unknown = null;
  taskDependency: unknown = null;
  navigator: unknown = null;
  /** Navigators definidos (Ruby `@project['navigators']`). */
  readonly navigators = new Map<string, unknown>();
  limits: Limits | null = null;
  limitInterval: ScoreboardInterval | null = null;
  limitResources: Resource[] = [];
  shiftAssignments: unknown = null;

  column: unknown = null;
  timeSheet: unknown = null;
  timeSheetRecord: unknown = null;
  sheetAuthor: unknown = null;
  sheetStart: unknown = null;
  sheetEnd: unknown = null;
  sheetModerator: unknown = null;
  /** Pilha de propriedades p/ statusSheetTask aninhado (Ruby @propertyStack). */
  propertyStack: unknown[] = [];
  reportCounter = 0;
  projectId = "";

  sortProperty: string[] | null = null;
  ruleToExtend: Rule | null = null;
  ruleToExtendWithScenario: Rule | null = null;
  propertySet: PropertySet | null = null;

  /** Idioma do arquivo (extensão SyntaxMesh — ADR 023). */
  language: string;
  /** Registro de idiomas usado pelo scanner. */
  registry: LanguageRegistry;

  /** Scanner TJP corrente (estreitamento do `scanner` da base). */
  protected tjpScanner: ProjectFileScanner | null = null;

  /** Acesso ao scanner para testes/macro inspeção. */
  get scannerRef(): ProjectFileScanner | null {
    return this.tjpScanner;
  }

  constructor(
    language = "en",
    registry: LanguageRegistry = globalRegistry,
  ) {
    super();
    // Tipos de token que o ProjectFileScanner pode devolver p/ variáveis.
    this.variables = [
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
    ];
    this.language = language;
    this.registry = registry;
    this.project = null;
    // Nada do parser deve ser marcado como 'herdado' durante o parse.
    AttributeBase.setMode(0,);
    this.initRules();
    this.updateParserTables();
  }

  /**
   * Registro das regras TJP. Substitui a reflection `rule_*` do Ruby:
   * `TjpSyntaxRules` é portado como módulos de funções (10.11–10.14).
   */
  override initRules(): void {
    registerTjpRules(this,);
  }

  /**
   * Abre um arquivo (ou buffer) para processamento. `master` marca o
   * arquivo-raiz da hierarquia de includes.
   */
  open(
    file: string,
    master: boolean,
    fileNameIsBuffer = false,
  ): void {
    let language = this.language;
    if (master) {
      // 10.17: pré-scan da diretiva `language "..."` (somente no mestre).
      const detected = this.detectLanguageOfFile(file, fileNameIsBuffer,);
      if (detected !== null) {
        language = detected;
      }
    }
    const scanner = new ProjectFileScanner(
      file,
      NULL_LOG,
      language,
      this.registry,
    );
    this.tjpScanner = scanner;
    // A base usa `this.scanner` para delegar error/warning/sourceFileInfo.
    this.scanner = scanner;
    this.language = language;

    // We need the ProjectFileScanner object for error reporting.
    if (
      master && !fileNameIsBuffer && file !== "." &&
      !file.endsWith(".tjp",)
    ) {
      this.error(
        "illegal_extension",
        "Project file name must end with '.tjp' extension",
      );
    }
    scanner.open(fileNameIsBuffer,);

    this.property = null;
    this.scenarioIdx = 0;
    this.initFileStack();
    // Stack for property IDs. Needed to handle nested 'supplement'
    // statements.
    this.idStack = [];

    // Macros globais só fazem sentido quando já há um projeto (reabertura
    // do mestre após 'project'); nas primeiras chamadas @project é null.
    if (master && this.project) {
      this.setGlobalMacros();
    }
  }

  /** Fecha o scanner e limpa estruturas. */
  close(): void {
    if (this.tjpScanner) {
      this.tjpScanner.close();
    }
    this.scanner = null;
    this.tjpScanner = null;
  }

  /** Entrega o próximo token do scanner ao FSM. */
  protected override nextToken(): ParserToken {
    if (!this.tjpScanner) {
      return ["endOfText", "", null,];
    }
    return this.tjpScanner.nextToken() as ParserToken;
  }

  /** Devolve o token ao scanner (push-back LIFO). */
  protected override returnToken(token: ParserToken | null,): void {
    if (this.tjpScanner && token) {
      this.tjpScanner.returnToken(token,);
    }
  }

  /**
   * Lê o texto do arquivo apenas para detectar o idioma (10.17).
   * Silencioso em erro — a abertura posterior reportará o problema real.
   */
  private detectLanguageOfFile(
    file: string,
    fileNameIsBuffer: boolean,
  ): string | null {
    try {
      const content = fileNameIsBuffer ? file : loadFileText(file,);
      const lang = detectLanguage(content,);
      if (lang === null) return null;
      if (lang !== "en" && this.registry.get(lang,) === null) {
        this.warning(
          "language_unknown",
          `Language '${lang}' is not supported. Falling back to 'en'.`,
        );
        return "en";
      }
      return lang;
    } catch {
      return null;
    }
  }

  /**
   * Macros padrão presentes em todo arquivo após a leitura do cabeçalho
   * do projeto (Ruby setGlobalMacros).
   */
  setGlobalMacros(): void {
    if (!this.project || !this.tjpScanner) return;
    const sfi = this.tjpScanner.sourceFileInfo();
    const start = this.project.get("start",) as TjTime | undefined;
    const end = this.project.get("end",) as TjTime | undefined;
    const now = this.project.get("now",) as TjTime | undefined;
    const timeFormat = (this.project.get("timeFormat",) as string) ??
      undefined;
    this.tjpScanner.addMacro(
      new Macro("projectstart", start ? start.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro("projectend", end ? end.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro("now", now ? now.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro(
        "today",
        now ? now.to_s(timeFormat ?? "%Y-%m-%d",) : "",
        sfi,
      ),
    );
  }

  /** Parse de atributos dinâmicos de um relatório (Ruby l.105-110). */
  parseReportAttributes(report: Report, attributes: string,): void {
    this.open(attributes, false, true,);
    this.property = report;
    this.project = report.project as unknown as Project;
    this.parse("dynamicAttributes",);
  }

  // ---------------------------------------------------------------------
  // Helpers usados pelas actions das regras (TjpSyntaxRules).
  // ---------------------------------------------------------------------

  /**
   * Converte o nome de um dia de semana (val[0]) no índice 0=dom, 1=seg...
   * Port de weekDay. Dias em outros idiomas já foram normalizados pelo
   * scanner para as formas canônicas en (ADR 023).
   */
  weekDay(name?: unknown,): number {
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat",];
    const day = names.indexOf(String(name ?? this.val[0],),);
    if (day < 0) {
      this.error(
        "weekday",
        `Weekday name expected (${names.join(", ",)})`,
      );
    }
    return day;
  }

  /** Impede atributos após sub-propriedades (Ruby checkContainer). */
  checkContainer(attribute: string,): void {
    if (this.property && this.property.container()) {
      this.error(
        "container_attribute",
        `The attribute ${attribute} may not be used for this property ` +
          "after sub properties have been added.",
        this.sourceFileInfo[0] ?? null,
        this.property,
      );
    }
  }

  /** TimeInterval deve caber inteiramente no período do projeto. */
  checkInterval(iv: TimeInterval,): void {
    const start = this.project?.get("start",) as TjTime | undefined;
    const end = this.project?.get("end",) as TjTime | undefined;
    if (!start || !end) return;
    if (
      iv.start.toSeconds() < start.toSeconds() ||
      iv.start.toSeconds() >= end.toSeconds()
    ) {
      this.error(
        "interval_start_in_range",
        `Start date ${iv.start.to_s()} must be within the project time ` +
          `frame (${start.to_s()} - ${end.to_s()})`,
      );
    }
    if (
      iv.end.toSeconds() <= start.toSeconds() ||
      iv.end.toSeconds() > end.toSeconds()
    ) {
      this.error(
        "interval_end_in_range",
        `End date ${iv.end.to_s()} must be within the project time ` +
          `frame (${start.to_s()} - ${end.to_s()})`,
      );
    }
  }

  /** Valida integridade de um statement 'booking'. */
  checkBooking(task: Task, resource: Resource,): void {
    if (!task.leaf()) {
      this.error(
        "booking_no_leaf",
        `${task.fullId} is not a leaf task`,
        this.sourceFileInfo[0] ?? null,
        task,
      );
    }
    if (task.getForScenario("milestone", this.scenarioIdx,)) {
      this.error(
        "booking_milestone",
        "You cannot add bookings to a milestone",
        this.sourceFileInfo[0] ?? null,
        task,
      );
    }
    if (!resource.leaf()) {
      this.error(
        "booking_group",
        "You cannot book a group resource",
        this.sourceFileInfo[0] ?? null,
        resource,
      );
    }
  }

  /**
   * Estende o PropertySet corrente com um atributo definido pelo usuário
   * (diretiva 'extend'). Retorna se o atributo é scenario-specific.
   */
  extendPropertySetDefinition(
    type: AttributeType,
    defaultValue: unknown,
  ): boolean {
    if (!this.propertySet) {
      return false;
    }
    const attrId = String(this.val[1],);
    const attrName = String(this.val[2],);
    if (this.propertySet.knownAttribute(attrId,)) {
      this.error(
        "extend_redefinition",
        `The extended attribute ${attrId} has already been defined.`,
      );
    }

    // Determine the values for scenarioSpecific and inheritable.
    let inherit = false;
    let scenarioSpecific = false;
    const options = this.val[3] as string[] | null | undefined;
    if (options) {
      for (const option of options) {
        if (option === "inherit") {
          inherit = true;
        } else if (option === "scenariospecific") {
          scenarioSpecific = true;
        }
      }
    }
    this.propertySet.addAttributeType(
      new AttributeDefinition(
        attrId,
        attrName,
        type,
        defaultValue,
        true, // userDefined / user-extendable
        false, // isList
        false, // isSingleton
        scenarioSpecific,
        inherit, // inheritedFromParent
      ),
    );

    // Add the new user-defined attribute as reportable attribute.
    const oldCurrentRule = this.cr;
    const reportable = this.rules.get("reportableAttributes",) ?? null;
    if (reportable) {
      this.cr = reportable;
      if (!reportable.includes(attrId,)) {
        this.singlePattern("_" + attrId,);
        this.descr(attrName,);
      }
    }
    this.cr = oldCurrentRule;

    return scenarioSpecific;
  }

  /**
   * Injeta a fábrica de RichText usada por {@link newRichText} (Fase 12.18.3).
   * O parser da Fase 10 chamava um stub ancorado; com a fábrica real plugada,
   * `note`/`details`/etc. passam a produzir `RichTextIntermediate` de verdade.
   */
  setRichTextFactory(factory: RichTextFactory,): void {
    this.richTextFactory = factory;
  }

  /**
   * Wrapper de RichText (ProjectFileParser.rb:221-233). Cria o
   * `RichTextIntermediate` via a fábrica, fazendo o baseline do SourceFileInfo
   * para que mensagens do parser de RichText apontem para o arquivo de origem.
   */
  newRichText(
    text: string,
    sfi: SourceFileInfo | null,
    tokenSet: string[] | null = null,
  ): RichTextIntermediate {
    const factory = this.richTextFactory ??
      new RichTextFactoryImpl(this.project, sfi,);
    const mh = MessageHandlerInstance.instance;
    mh.baselineSFI = sfi;
    try {
      const rti = factory.create(text, tokenSet,);
      rti.sectionNumbers = false;
      return rti;
    } finally {
      mh.baselineSFI = null;
    }
  }

  /**
   * Cria um Report único com id/verificação de duplicidade.
   * Port de newReport (Ruby l.240-280).
   */
  newReport(
    id: string | null,
    name: string,
    type: string,
    sourceFileInfo: SourceFileInfo | null,
    defaultAttrs?: (this: ProjectFileParser,) => void,
  ): Report | null {
    if (!this.project) return null;
    // If there is no parent property and the report prefix is not empty,
    // the reportprefix defines the parent property.
    if (this.property === null && this.reportprefix !== "") {
      this.property = this.project.report(this.reportprefix,);
    }

    let reportId = id;
    if (reportId) {
      // Report IDs must be unique; prepend the scope property ID.
      reportId = (this.property ? this.property.fullId + "." : "") + reportId;
      if (this.project.report(reportId,)) {
        this.error(
          "report_exists",
          `report ${reportId} has already been defined.`,
          sourceFileInfo,
          this.property,
        );
      }
    }

    this.reportCounter += 1;
    if (name !== "." && name !== "") {
      if (this.project.reportByName(name,)) {
        this.error(
          "report_redefinition",
          `A report with the name ${name} has already been defined.`,
        );
      }
    }
    const report = new Report(
      this.project,
      reportId || `report${this.reportCounter}`,
      name,
      this.property ? (this.property as Report) : null,
    );
    report.typeSpec = type as never;
    report.sourceFileInfo = sourceFileInfo;
    report.inheritAttributes();

    // Ruby define @property = report ANTES do bloco de defaults, de modo que
    // defaultAttrs referencia o próprio relatório (columns/hideTask/...).
    this.property = report;
    if (defaultAttrs) {
      // The default attribute values for this report type have to be set in
      // 'inherited' mode since they are not user provided.
      AttributeBase.setMode(1,);
      defaultAttrs.call(this,);
      AttributeBase.setMode(0,);
    }
    return report;
  }

  /** Cria Limits por recurso quando há lista de recursos (Ruby l.284). */
  setLimit(
    name: string,
    value: number,
    interval?: ScoreboardInterval,
  ): void {
    if (!this.limits) return;
    if (this.limitResources.length === 0) {
      this.limits.setLimit(name, value, interval,);
    } else {
      for (const resource of this.limitResources) {
        this.limits.setLimit(name, value, interval, resource,);
      }
    }
  }

  /**
   * Marca o critério de duração da tarefa, resetando os demais
   * (duration/length/effort/milestone são mutuamente exclusivos).
   */
  setDurationAttribute(
    attribute: string,
    value: unknown = true,
  ): void {
    this.checkContainer(attribute,);
    if (!this.property) return;
    const others: Record<string, unknown> = {
      milestone: false,
      duration: 0,
      length: 0,
      effort: 0,
    };
    for (const [attr, val,] of Object.entries(others,)) {
      if (attribute === attr) {
        this.property.setForScenario(attr, value, this.scenarioIdx,);
      } else {
        if (this.property.getAttribute(attr, this.scenarioIdx,).provided) {
          this.error(
            "multiple_durations",
            "This duration criteria is overwriting a previously provided " +
              "criteria (duration, effort, length or milestone).",
          );
        }
        this.property.setForScenario(attr, val, this.scenarioIdx,);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Conveniências para definição da árvore de sintaxe (Ruby l.312-440).
  // ---------------------------------------------------------------------

  /** Lista de keywords com atalhos '*' (tudo) e '-' (nada). */
  allOrNothingListRule(
    name: string,
    items: string[] | Record<string, string | null>,
  ): void {
    this.newRule(name, () => {
      // A '*' means all possible items should be in the list.
      this.pattern(["_*",], function (this: ProjectFileParser,): unknown {
        return ["*",];
      },);
      this.descr("A shortcut for all items",);
      // A '-' means the list should be empty.
      this.pattern(["_-",], function (): unknown {
        return [];
      },);
      this.descr("No items",);
      // Or the list consists of one or more comma separated keywords.
      this.pattern(
        [`!${name}_AoN_ruleItems`,],
        function (this: ProjectFileParser,): unknown {
          return this.val[0];
        },
      );
    },);
    // Create the rule for the comma separated list.
    this.newRule(`${name}_AoN_ruleItems`, () => {
      this.listRule(`more${name}_AoN_ruleItems`, `!${name}_AoN_ruleItem`,);
    },);
    // Create the rule for the keywords with their description.
    this.newRule(`${name}_AoN_ruleItem`, () => {
      if (Array.isArray(items,)) {
        for (const keyword of items) {
          this.singlePattern("_" + keyword,);
        }
      } else {
        for (const [keyword, description,] of Object.entries(items,)) {
          this.singlePattern("_" + keyword,);
          if (description) {
            this.descr(description,);
          }
        }
      }
    },);
  }

  /** Lista separada por vírgulas com detecção de duplicatas. */
  listRule(name: string, listItem: string,): void {
    this.pattern(
      [listItem, `!${name}`,],
      function (this: ProjectFileParser,): unknown {
        const rest = this.val[1] as unknown[] | null;
        if (rest && rest.includes(this.val[0],)) {
          this.error("duplicate_in_list", "Duplicate items in list.",);
        }
        return [this.val[0],].concat(rest ?? [],);
      },
    );
    this.newRule(name, () => {
      this.commaListRule(listItem,);
    },);
  }

  /** Cauda repetível `_, item` de uma listRule. */
  commaListRule(listItem: string,): void {
    this.optional();
    this.repeatable();
    this.pattern(
      ["_,", listItem,],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  }

  /** Bloco opcional `{ ... }` de atributos. */
  optionsRule(attributes: string,): void {
    this.optional();
    this.pattern(
      ["_{", `!${attributes}`, "_}",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  }

  /** Padrão de item único que devolve o próprio valor. */
  singlePattern(item: string,): void {
    this.pattern([item,], function (this: ProjectFileParser,): unknown {
      return this.val[0];
    },);
  }

  /** Documentação genérica do padrão corrente. */
  doc(keyword: string, text: string,): void {
    this.cr?.setDoc(keyword, text,);
  }

  /** Documentação para padrões de um único token terminal. */
  descr(text: string,): void {
    const cr = this.cr;
    if (!cr) return;
    const last = cr.patterns[cr.patterns.length - 1];
    if (
      !last || last.tokens.length !== 1 ||
      (last.tokens[0]![0] !== "literal" && last.tokens[0]![0] !== "variable")
    ) {
      throw new Error(
        "descr() may only be used for patterns with terminal tokens.",
      );
    }
    this.arg(0, null, text,);
  }

  /** Documentação do argumento _idx_ do padrão corrente. */
  arg(
    idx: number,
    name: string | null,
    text: string,
  ): void {
    this.cr?.setArg(idx, new TokenDoc(name, text,),);
  }

  /** Restringe a sintaxe documentada aos primeiros _idx_ tokens. */
  lastSyntaxToken(idx: number,): void {
    this.cr?.setLastSyntaxToken(idx,);
  }

  /** Nível de suporte do padrão corrente ('current'|'deprecated'|'removed'). */
  level(level: string,): void {
    this.cr?.setSupportLevel(level,);
  }

  /** Referência cruzada na documentação ('see also'). */
  also(seeAlso: string | string[],): void {
    const list = Array.isArray(seeAlso,) ? seeAlso : [seeAlso,];
    this.cr?.setSeeAlso(list,);
  }

  /** Anexo de exemplo TJP à documentação do padrão. */
  example(file: string, tag: string | null = null,): void {
    this.cr?.setExample(file, tag ?? "",);
  }

  /** Título da coluna _colId_ em tabelas de relatório. */
  columnTitle(colId: string,): string | undefined {
    if (
      this.property instanceof Report &&
      String(this.property.typeSpec,) === "tracereport"
    ) {
      return `<-id->:<-scenario->.${colId}`;
    }
    return this.project?.attributeName(colId,);
  }

  // ---------------------------------------------------------------------
  // File stack — variáveis de escopo de arquivo (Ruby l.453-505).
  // ---------------------------------------------------------------------

  /** Cria/reseta a pilha de escopo de arquivo. */
  initFileStack(): void {
    this.fileStackVariables = [
      "taskprefix",
      "reportprefix",
      "resourceprefix",
      "accountprefix",
    ];
    const stackEntry: Record<string, string> = {};
    for (const variable of this.fileStackVariables) {
      stackEntry[variable] = "";
      (this as unknown as Record<string, string>)[variable] = "";
    }
    this.fileStack = [stackEntry,];
  }

  /** Empurra o conjunto atual de variáveis de arquivo. */
  pushFileStack(): void {
    const stackEntry: Record<string, string> = {};
    for (const variable of this.fileStackVariables) {
      stackEntry[variable] =
        (this as unknown as Record<string, string>)[variable]!;
    }
    this.fileStack.push(stackEntry,);
  }

  /** Pop + restauração; @property volta a null (incluies aninhados). */
  popFileStack(): void {
    const stackEntry = this.fileStack.pop();
    if (stackEntry) {
      for (const variable of this.fileStackVariables) {
        (this as unknown as Record<string, string>)[variable] =
          stackEntry[variable]!;
      }
    }
    // Include files can only occur at global level or in the project
    // header. In both cases the @property must be nil after the include.
    this.property = null;
  }

  /**
   * Append seguro para listas scenario-specific: `<<` não marca 'provided',
   * então forçamos um self-set (Ruby l.494-505).
   */
  appendScListAttribute(
    attrId: string,
    list: unknown[],
  ): void {
    if (!this.property) return;
    for (const v of list) {
      (this.property.getForScenario(attrId, this.scenarioIdx,) as unknown[])
        .push(v,);
    }
    try {
      this.property.setForScenario(
        attrId,
        this.property.getForScenario(attrId, this.scenarioIdx,),
        this.scenarioIdx,
      );
    } catch (e) {
      // Overwrites are ok here.
      if (!(e instanceof AttributeOverwrite)) {
        throw e;
      }
    }
  }

  /** true se a macro _name_ já existe no scanner (Ruby macroDefined?). */
  scannerHasMacro(name: string,): boolean {
    return this.tjpScanner ? this.tjpScanner.macroDefined(name,) : false;
  }

  /** Registra uma macro no scanner corrente. */
  addScannerMacro(macro: Macro,): void {
    this.tjpScanner?.addMacro(macro,);
  }

  /** Acesso ao MessageHandler (regras verificam contagem de erros). */
  get messageHandler(): MessageHandlerInstance {
    return MessageHandlerInstance.instance;
  }
}
