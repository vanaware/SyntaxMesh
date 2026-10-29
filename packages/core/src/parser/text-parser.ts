import { MessageHandlerInstance, } from "../message-handler.ts";
import { Message, } from "../message.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { AttributeOverwrite, TjError, } from "../model/errors.ts";
import { Pattern, } from "./pattern.ts";
import { Rule, } from "./rule.ts";
import { StackElement, } from "./stack-element.ts";
import {
  State,
  stateKeyOf,
  type StateKeys,
  StateTransition,
} from "./state.ts";

/**
 * ParserToken — token entregue pelo scanner ao FSM.
 * [type, name, sourceFileInfo], espelhando o Ruby `[type, name, sfi]`.
 * Elemento 1 é `unknown` porque o Scanner converte valores (DATE → TjTime,
 * INTEGER/FLOAT → number, TIME → segundos), como no Ruby.
 */
export type ParserToken = [string, unknown, SourceFileInfo | null,];

/**
 * Host mínimo que uma action de Pattern recebe ao ser chamada.
 * Em Ruby a action roda via instance_eval no TextParser e lê @val/@sourceFileInfo;
 * aqui recebe o próprio parser tipado estruturalmente (evita import circular).
 */
export interface ParserActionHost {
  readonly val: unknown[];
  readonly sourceFileInfo: Array<SourceFileInfo | null>;
}

/** Ordem canônica dos tipos de token do scanner (referência: Scanner.rb). */
const SCANNER_TOKEN_TYPES: string[] = [
  "scope",
  "time",
  "ID",
  "KEYWORD",
  "STRING",
  "BC",
  "IC",
  "SC",
  "LC",
  "RC",
  "RS",
  "URL",
  "EMAIL",
  "TF",
  "endOfText",
];

/**
 * Converte o nome de um tipo de token em inteiro estável.
 * Retorno sempre >= 0 para tipos conhecidos; -1 para desconhecidos.
 */
export function tokenTypeToInt(type: string,): number {
  return SCANNER_TOKEN_TYPES.indexOf(type,);
}

/**
 * TextParser — autômato finito (FSM) com gramática compilada em runtime.
 *
 * Port linha-a-linha de TextParser.rb. Classe abstrata: subclasses implementam
 * o conjunto de regras (`rule_*` via `initRules`) e `nextToken`/`returnToken`.
 * Ações de Pattern são callbacks comuns (sem arrow) que recebem o parser como
 * `this`/argumento e leem `parser.val` / `parser.sourceFileInfo`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser.rb
 * @see ADR 022 (FSM compilada em runtime)
 */
export abstract class TextParser {
  /** Conjunto de regras do parser (Ruby @rules, Symbol → string). */
  readonly rules: Map<string, Rule> = new Map();
  /** Tipos de token que o scanner pode retornar (Ruby @variables). */
  variables: string[] = [];
  /** Nome da regra corrente (Ruby @cr). */
  cr: Rule | null = null;
  /** Estados do FSM: chave de identidade → State (Ruby @states). */
  states: Map<string, State> = new Map();
  /** Pilha do FSM (Ruby @stack). */
  stack: StackElement[] | null = null;
  /** Resultados dos tokens do padrão em processamento (Ruby @val). */
  val: unknown[] = [];
  /** SourceFileInfo dos tokens do padrão em processamento (Ruby @sourceFileInfo). */
  sourceFileInfo: Array<SourceFileInfo | null> = [];
  /** Scanner delegado (TextScanner, Fase 10.10). */
  protected scanner: unknown | null = null;
  /** Mapa de identidade para chaves de estado (substitui states[[rule, pat, i]]). */
  private _stateKeys: StateKeys = new Map();
  /** Tokens bloqueados por limitTokenSet (Ruby @blockedVariables). */
  private _blockedVariables: Map<string, boolean> = new Map();
  /** Lista explícita de métodos `rule_*` (reflection não portável). */
  ruleMethods: string[] = [];

  /**
   * Restringe os tokens aceitos pelo scanner ao subconjunto _tokenSet_.
   * Port de limitTokenSet (TextParser.rb l.98-110).
   */
  limitTokenSet(tokenSet: string[] | null,): void {
    if (!tokenSet) {
      return;
    }
    // Copia de todos os suportados, remove os do conjunto limitado.
    const blockedVariables = [...this.variables,];
    for (const token of tokenSet) {
      const idx = blockedVariables.indexOf(token,);
      if (idx >= 0) {
        blockedVariables.splice(idx, 1,);
      }
    }
    this._blockedVariables = new Map();
    for (const v of blockedVariables) {
      this._blockedVariables.set(v, true,);
    }
  }

  /**
   * Limpa o conjunto de tokens bloqueados (Ruby `@blockedVariables = {}` no
   * `RichTextParser#reuse`). Protegido: só subclasses que reusam o singleton
   * precisam deste reset explícito entre parses.
   */
  protected clearBlockedVariables(): void {
    this._blockedVariables = new Map();
  }

  /**
   * Chama todos os métodos `rule_*` para inicializar as regras.
   * Em Ruby usa reflection (methods.grep(/^rule_/)); em TS a lista é
   * explícita via `ruleMethods` (cheat-sheet §12 Category B).
   */
  initRules(): void {
    for (const m of this.ruleMethods) {
      if (!m.startsWith("rule_",)) {
        throw new Error(`Rule method name must start with 'rule_': ${m}`,);
      }
      const fn = (this as unknown as Record<string, () => void>)[m];
      if (typeof fn !== "function") {
        throw new Error(`Rule method not found: ${m}`,);
      }
      // Cria a regra com o sufixo do nome da função como nome.
      this.newRule(m.slice(5,),);
      fn.call(this,);
    }
  }

  /**
   * Adiciona uma nova regra ao rule set e a torna a regra corrente.
   * Port de newRule (TextParser.rb l.124-142). Diferença intencional: se a
   * regra já existe (registro via initRules), reutiliza-a — Ruby não tem o
   * equivalente de `ruleMethods` e por isso lançava nesse caso.
   */
  newRule(name: string, block?: (() => void) | null,): void {
    const rule = this.rules.get(name,) ?? new Rule(name,);
    this.rules.set(name, rule,);
    if (block) {
      const saveCr = this.cr;
      this.cr = rule;
      block();
      this.cr = saveCr;
    } else {
      this.cr = rule;
    }
  }

  /**
   * Adiciona um padrão à regra mais recentemente adicionada.
   * Port de pattern (TextParser.rb l.144-157).
   */
  pattern(tokens: string[], func: (() => unknown) | null = null,): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.addPattern(new Pattern(tokens, func,),);
  }

  /** Marca os padrões da regra corrente como opcionais. */
  optional(): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.setOptional();
  }

  /** Marca os padrões da regra corrente como repetíveis. */
  repeatable(): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.setRepeatable();
  }

  /**
   * Re-compila o FSM após mudanças no rule set (extend, novas regras).
   * Port de updateParserTables (TextParser.rb l.171-192).
   */
  updateParserTables(): void {
    this.saveFsmStack();
    // Invalida dados em cache.
    for (const rule of this.rules.values()) {
      rule.flushCache();
    }
    this.states = new Map();
    // Gera os estados de todos os padrões de todas as regras.
    for (const rule of this.rules.values()) {
      for (const s of rule.generateStates(this.rules,)) {
        this.states.set(
          stateKeyOf(s.rule, s.pattern, s.index, this._stateKeys,),
          s,
        );
      }
      this.checkRule(rule,);
    }
    // Calcula as transições entre os estados gerados.
    for (const state of this.states.values()) {
      state.addTransitions(this.states, this.rules, this._stateKeys,);
    }
    this.restoreFsmStack();
  }

  /**
   * Executa o parse da regra _ruleName_. Retorna o resultado da action de
   * topo, ou false em caso de erro. Port de parse (TextParser.rb l.194-211).
   */
  parse(ruleName: string,): unknown {
    this.stack = [];
    try {
      const rule = this.rules.get(ruleName,) ?? null;
      return this.parseFSM(rule!,);
    } catch (msg) {
      if (msg instanceof TjError) {
        if (msg.message) {
          MessageHandlerInstance.instance.critical(
            "parse",
            msg.message,
            null,
            null,
            null,
            null,
          );
        }
        return false;
      }
      throw msg;
    }
  }

  /**
   * SourceFileInfo do início da regra atualmente processada.
   * Port de sourceFileInfo (TextParser.rb l.213-219).
   */
  getSourceFileInfo(): SourceFileInfo | null {
    if (this.stack === null || this.stack.length <= 1) {
      const scanner = this.scanner as
        | {
          sourceFileInfo: SourceFileInfo | null | (() => SourceFileInfo);
        }
        | null;
      if (!scanner) {
        return null;
      }
      // Scanner real expõe método; fakes de teste podem expor propriedade.
      return typeof scanner.sourceFileInfo === "function"
        ? scanner.sourceFileInfo()
        : scanner.sourceFileInfo;
    }
    return this.stack[this.stack.length - 1]!.firstSourceFileInfo;
  }

  /**
   * Registra um erro. Com scanner, delega (tem mais contexto); sem scanner,
   * loga no MessageHandler — Ruby recursava (bug real, l.221-230).
   */
  error(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    const at = this.scanner as
      | {
        error: (
          id: string,
          text: string,
          sfi: SourceFileInfo | null,
          data: unknown,
        ) => void;
      }
      | null;
    if (at) {
      at.error(id, text, sfi ?? this.getSourceFileInfo(), data,);
    } else {
      this.logMessage(
        "error",
        id,
        text,
        sfi ?? this.getSourceFileInfo(),
        data,
      );
    }
  }

  /**
   * Registra um warning. Mesma delegação de error (TextParser.rb l.232-241).
   */
  warning(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    const at = this.scanner as
      | {
        warning: (
          id: string,
          text: string,
          sfi: SourceFileInfo | null,
          data: unknown,
        ) => void;
      }
      | null;
    if (at) {
      at.warning(id, text, sfi ?? this.getSourceFileInfo(), data,);
    } else {
      this.logMessage(
        "warning",
        id,
        text,
        sfi ?? this.getSourceFileInfo(),
        data,
      );
    }
  }

  /** Log direto no MessageHandler (equivalente a MessageHandler#error Ruby, que não lança). */
  private logMessage(
    type: "error" | "warning",
    id: string,
    text: string,
    sfi: SourceFileInfo | null,
    data: unknown,
  ): void {
    const mh = MessageHandlerInstance.instance;
    mh.messages.push(new Message(type, id, text, sfi, null, data, null,),);
    if (type === "error") {
      mh.errors++;
    }
  }

  /**
   * Valida uma regra: padrões não-vazios, tokens conhecidos, referências válidas.
   * Port de checkRule (TextParser.rb l.245-265).
   */
  private checkRule(rule: Rule,): void {
    if (rule.patterns.length === 0) {
      throw new Error(`Rule ${rule.name} must have at least one pattern`,);
    }
    for (const pat of rule.patterns) {
      for (const [type, name,] of pat.tokens) {
        if (type === "variable") {
          if (this.variables.indexOf(name,) < 0) {
            this.error(
              "unsupported_token",
              `The token ${name} is not supported here.`,
            );
          }
        } else if (type === "reference") {
          if (!this.rules.get(name,)) {
            throw new Error(
              `Fatal Error: Reference to unknown rule ${name} in ` +
                `pattern '${JSON.stringify(pat.tokens,)}' of rule ${rule.name}`,
            );
          }
        }
      }
    }
  }

  /**
   * Loop SHIFT/REDUCE do FSM. Port de parseFSM (TextParser.rb l.267-356).
   * Nenhuma arrow function aqui — ações executam com `this` = parser.
   */
  private parseFSM(rule: Rule | null,): unknown {
    const state = rule
      ? this.states.get(stateKeyOf(rule, null, 0, this._stateKeys,),)
      : undefined;
    if (!state) {
      this.error(
        "no_start_state",
        `No start state for rule ${rule === null ? "<nil>" : rule.name} found`,
      );
      // Ruby prosseguia com state=nil (MessageHandler#error não lançava); em
      // TS não há como continuar sem state — saímos com false.
      return false;
    }
    this.stack = [new StackElement(null, state,),];

    let currentState: State = state;
    for (;;) {
      let transition: StateTransition | null = null;
      let token: ParserToken | null = null;
      if (currentState.transitions.size === 0) {
        // Estados finais de cada padrão não têm transições pré-compiladas.
        // Para tal estado, não precisamos pegar um novo token.
      } else {
        token = this.getNextToken();
        transition = currentState.transition(
          token as unknown as [string, string,],
        );
      }

      // Se fizemos loop-back, precisamos terminar o padrão primeiro.
      // Tokens finais de regras repetíveis têm transições!
      if (transition && transition.loopBack) {
        this.finishPattern(token,);
        token = this.getNextToken();
        transition = currentState.transition(
          token as unknown as [string, string,],
        );
      }

      if (transition) {
        // SHIFT: transição normal — próximo token do mesmo padrão ou início
        // de um novo padrão. A transição diz qual estado processar a seguir.
        currentState = transition.state;

        // Transições que entram em regras geram estados onde precisamos
        // retornar quando a regra terminar. Empilhamos essa lista em @stack.
        const stackElement = this.stack[this.stack.length - 1]!;
        let first = true;
        for (const s of transition.stateStack) {
          this.checkForOldSyntax(s, token!,);
          // `stackElement.state` pode ser tupla [rule, pattern, index] —
          // resolve como State antes de comparar o padrão (fiel a Ruby,
          // que lê stackElement.state.pattern a cada iteração).
          if (first && s.pattern === this.stateOf(stackElement,)?.pattern) {
            // O primeiro estado da lista pode ser apenas outro estado do
            // padrão corrente — o StackElement já está na pilha.
            stackElement.state = s;
          } else {
            // Guardamos [rule, pattern, index] (equivalente Ruby) para que
            // save/restoreFsmStack operem sobre a mesma representação.
            this.stack.push(
              new StackElement(null, [s.rule, s.pattern, s.index,],),
            );
          }
          first = false;
        }

        if (currentState.index === 0) {
          // Começamos um novo padrão (ou loop-back): empurra novo StackEntry,
          // que guarda o resultado do padrão e o estado de retorno.
          this.checkForOldSyntax(currentState, token!,);
          this.stack.push(
            new StackElement(
              currentState.pattern ? currentState.pattern.function : null,
              [currentState.rule, currentState.pattern, currentState.index,],
            ),
          );
        }

        // Guarda o valor do token no Array de resultados.
        this.stack[this.stack.length - 1]?.insert(
          currentState.index,
          token ? token[1] : null,
          token ? token[2] : null,
          false,
        );
      } else {
        // REDUCE: chegamos ao fim de uma regra. Não há transição
        // pré-compilada; o token atual, se houver, não nos serve aqui —
        // finishPattern o devolve ao scanner.
        if (currentState.noReduce) {
          // Só estados que fecham uma regra podem disparar reduce. Estados
          // com noReduce encontrado aqui indicam token não suportado.
          const top = this.stack[this.stack.length - 1];
          const topState = top ? this.stateOf(top,) : null;
          const expected = topState ? topState.expectedTokens() : [];
          this.error(
            "no_reduce",
            `Unexpected token '${token ? token[1] : "<END>"}' found. ` +
              `${expected.length > 1 ? "one of " : ""}` +
              `${expected.join(", ",)}`,
            token ? token[2] : null,
          );
        }
        if (this.finishPattern(token,)) {
          // ACCEPT: terminamos o parse.
          break;
        }
        const next = this.stateOf(
          this.stack[this.stack.length - 1],
        );
        if (!next) {
          // Ruby continuaria com state=nil e crasharia no TypeError; em TS
          // encerramos após o erro ter sido registrado.
          break;
        }
        currentState = next;
      }
    }

    return this.stack && this.stack.length > 0 ? this.stack[0]!.val[0] : null;
  }

  /** Resolve o State de um StackElement (State puro ou tupla [rule, pattern, index]). */
  private stateOf(entry: StackElement | undefined,): State | null {
    const st = entry?.state;
    if (st instanceof State) {
      return st;
    }
    if (Array.isArray(st,) && st.length === 3) {
      const [rule, pattern, index,] = st as [Rule, Pattern | null, number,];
      return this.states.get(
        stateKeyOf(rule, pattern, index, this._stateKeys,),
      ) ?? null;
    }
    return null;
  }

  /**
   * Termina o padrão no topo da pilha: pop, chama a action, insere o
   * resultado no nível inferior. Port de finishPattern (TextParser.rb l.358-410).
   */
  private finishPattern(token: ParserToken | null,): boolean {
    // A action deste padrão pode incluir outro arquivo ou mudar as regras;
    // devolvemos o token ao scanner antes de qualquer coisa.
    if (token) {
      this.returnToken(token,);
    }

    // Para terminar um padrão, pop do StackElement com os valores dos tokens.
    const stackEntry = this.stack!.pop();
    if (stackEntry === undefined || this.stack!.length === 0) {
      // Chegamos ao fundo da pilha.
      const t = this.getNextToken();
      if (t[0] === "endOfText") {
        // Fim do arquivo de topo: guardamos o StackEntry de volta (contém o
        // resultado global do parse) e sinalizamos ACCEPT.
        this.stack!.push(stackEntry!,);
        return true;
      }
      // Token que viola as regras de sintaxe.
      const expected = stackEntry
        ? (this.stateOf(stackEntry,)?.expectedTokens() ?? []).join(", ",)
        : "";
      this.error(
        "unexpctd_token",
        `Unexpected token '${t[1]}' found. Expecting one of ${expected}`,
        t[2],
      );
    }

    // Memoriza se a regra deste padrão era repetível; o resultado vira Array.
    const state = stackEntry === undefined ? null : this.stateOf(stackEntry,) ??
      (stackEntry.state instanceof State ? stackEntry.state : null);
    if (!state) {
      // Ruby: stackEntry nil → NoMethodError. Em TS: encerra o padrão.
      return false;
    }
    const ruleIsRepeatable = state.rule.repeatable;
    let result: unknown = null;
    if (state.pattern && state.pattern.function) {
      // Disponibiliza os valores dos tokens e seus SourceFileInfo à action.
      // Ruby: `@val` é um Array onde índices de tokens opcionais não
      // preenchidos leem `nil`. Em TS, buracos viram `undefined` — os
      // índices do padrão são normalizados para null antes da action.
      const vals = stackEntry!.val;
      for (let i = 0; i < state.pattern.tokens.length; i++) {
        if (vals[i] === undefined) vals[i] = null;
      }
      this.val = vals;
      this.sourceFileInfo = stackEntry!.sourceFileInfo;
      try {
        // A action roda como callback comum (sem arrow): `this` = parser.
        result =
          (state.pattern.function as (host: ParserActionHost,) => unknown)
            .call(this, this,);
      } catch (e) {
        if (e instanceof AttributeOverwrite) {
          this.warning("attr_overwrite", e.message,);
        } else {
          throw e;
        }
      }
    }

    // Usamos o SourceFileInfo do primeiro token do padrão para o resultado.
    const firstSourceFileInfo = stackEntry!.firstSourceFileInfo;
    // Armazena o resultado na posição correta do nível inferior da pilha.
    const lowerEntry = this.stack![this.stack!.length - 1];
    const lowerState = lowerEntry ? this.stateOf(lowerEntry,) : null;
    if (lowerEntry && lowerState) {
      lowerEntry.insert(
        lowerState.index,
        result,
        firstSourceFileInfo,
        ruleIsRepeatable,
      );
    }
    return false;
  }

  /**
   * Imprime a pilha do FSM (debug). Port de dumpStack (TextParser.rb l.412-434).
   */
  protected dumpStack(): string {
    if (!this.stack) {
      return "";
    }
    let out = "";
    this.stack.forEach((sl, i,) => {
      out += `${i}: `;
      for (const v of sl.val) {
        if (Array.isArray(v,)) {
          try {
            out += `[${v.join("|",)}]|`;
          } catch {
            out += `[${v[0] === undefined ? "?" : typeof v[0]}...]|`;
          }
        } else {
          out += `${String(v,)}|`;
        }
      }
      const st = sl.state instanceof State ? sl.state.to_s(true,) : "nil";
      out += ` -> ${st}${sl.function === null ? "" : "(Called)"}\n`;
    },);
    return out;
  }

  /**
   * Detecta sintaxe deprecada/removida no token corrente.
   * Port de checkForOldSyntax (TextParser.rb l.436-449).
   */
  private checkForOldSyntax(state: State, token: ParserToken,): void {
    if (!state.pattern) {
      return;
    }
    if (state.pattern.supportLevel === "deprecated") {
      this.warning(
        "deprecated_keyword",
        `The keyword '${token[1]}' has been deprecated! ` +
          `See the reference manual for details.`,
        token[2],
      );
    }
    if (state.pattern.supportLevel === "removed") {
      this.error(
        "removed_keyword",
        `The keyword '${token[1]}' is no longer supported! ` +
          `See the reference manual for details.`,
        token[2],
      );
    }
  }

  /**
   * Converte os State objects da pilha em [rule, pattern, index] para
   * sobreviverem à re-compilação do FSM. Port de saveFsmStack (l.451-460).
   */
  private saveFsmStack(): void {
    if (!this.stack) {
      return;
    }
    for (const s of this.stack) {
      const st = this.stateOf(s,);
      if (st) {
        s.state = [st.rule, st.pattern, st.index,];
      }
    }
  }

  /**
   * Converte os [rule, pattern, index] da pilha de volta para State objects.
   * Port de restoreFsmStack (l.462-472).
   */
  private restoreFsmStack(): void {
    if (!this.stack) {
      return;
    }
    for (const s of this.stack) {
      const t = s.state;
      if (Array.isArray(t,) && t.length === 3) {
        const [rule, pattern, index,] = t as [Rule, Pattern | null, number,];
        const state = this.states.get(
          stateKeyOf(rule, pattern, index, this._stateKeys,),
        );
        if (!state) {
          throw new Error("Stack restore failed. Cannot find state",);
        }
        s.state = state;
      }
    }
  }

  /**
   * Pega o próximo token do scanner e aplica o conjunto bloqueado.
   * Port de getNextToken (TextParser.rb l.474-483).
   */
  protected getNextToken(): ParserToken {
    const token = this.nextToken();
    if (this._blockedVariables.get(token[0],)) {
      this.error(
        "unsupported_token",
        `The token ${token[1]} is not supported in this context.`,
        token[2],
      );
    }
    return token;
  }

  /** Entrega o token de volta ao scanner (push-back). Abstrata. */
  protected abstract returnToken(token: ParserToken | null,): void;

  /** Próximo token do scanner. Abstrata. */
  protected abstract nextToken(): ParserToken;
}
