import { Pattern, } from "./pattern.ts";
import { Rule, } from "./rule.ts";

/**
 * StateKey — unique identifier of a `State` in the FSM:
 * `[ruleName, patternName|null, index]`.
 */
export type StateKey = [string, string | null, number,];

/**
 * StateKeys — identity map equivalent to the Ruby `states[[rule, pattern, index]]`.
 * In TS objects are not Map keys by value, so we nest Maps by identity:
 * rule → pattern (null for the starting node) → index → key.
 */
export type StateKeys = Map<Rule, Map<Pattern | null, Map<number, string>>>;

let stateKeyCounter = 0;

/**
 * Returns the canonical key of a state, creating one when necessary.
 *
 * @param rule Rule of the state.
 * @param pattern Pattern of the state, or `null` for the starting node.
 * @param index Token index inside the pattern.
 * @param keys Identity map that stores the keys.
 * @returns The canonical key of the state.
 */
export function stateKeyOf(
  rule: Rule,
  pattern: Pattern | null,
  index: number,
  keys: StateKeys,
): string {
  let byPattern = keys.get(rule,);
  if (!byPattern) {
    byPattern = new Map();
    keys.set(rule, byPattern,);
  }
  let byIndex = byPattern.get(pattern,);
  if (!byIndex) {
    byIndex = new Map();
    byPattern.set(pattern, byIndex,);
  }
  let key = byIndex.get(index,);
  if (!key) {
    key = `s${stateKeyCounter++}`;
    byIndex.set(index, key,);
  }
  return key;
}

/**
 * StateTransition — maps a token type to the next state (and the stack and loop
 * flags that go with it).
 */
export class StateTransition {
  /** Token type that triggers the transition. */
  readonly tokenType: string | symbol;
  /** State reached after the transition. */
  readonly state: State;
  /** Stack snapshot taken when the transition was created. */
  readonly stateStack: State[];
  /** Whether the transition loops back to a previous state. */
  readonly loopBack: boolean;

  /**
   * Creates a transition.
   *
   * @param descriptor Token type and text that trigger the transition.
   * @param state State reached after the transition.
   * @param stateStack Stack snapshot to store.
   * @param loopBack Whether the transition loops back.
   * @throws Error When a parameter has the wrong shape or type.
   */
  constructor(
    descriptor: [string, string,],
    state: State,
    stateStack: State[],
    loopBack: boolean,
  ) {
    if (!descriptor || descriptor.length !== 2) {
      throw new Error(
        `Bad parameter descriptor: ${descriptor} of type ${typeof descriptor}`,
      );
    }
    this.tokenType = descriptor[0] === "eof" ? "eof" : descriptor[1];

    if (!(state instanceof State)) {
      throw new Error(`Bad parameter state: ${state} of type ${typeof state}`,);
    }
    this.state = state;

    if (!Array.isArray(stateStack,)) {
      throw new Error(
        `Bad parameter stateStack: ${stateStack} of type ${typeof stateStack}`,
      );
    }
    this.stateStack = [...stateStack,];
    this.loopBack = loopBack;
  }

  /** Renders the transition target plus the stack and the loop flag. */
  to_s(): string {
    let str = `${this.state.rule.name}, ` +
      `${
        this.state.rule.patterns.findIndex((p,) => p === this.state.pattern)
      }, ` +
      `${this.state.index} `;
    if (this.stateStack.length > 0) {
      str += "(";
      this.stateStack.forEach((s,) => {
        str += `${s.rule.name} `;
      },);
      str += ")";
    }
    if (this.loopBack) {
      str += "(loop)";
    }
    return str;
  }
}

/**
 * State — one state of the TextParser FSM: a rule plus, when it is not the
 * starting node, a pattern and a token index inside it.
 */
export class State {
  /** Rule the state belongs to. */
  readonly rule: Rule;
  /** Pattern of the state, or `null` for the starting node. */
  readonly pattern: Pattern | null;
  /** Token index inside the pattern. */
  readonly index: number;
  /** Transitions leaving the state, keyed by token type. */
  readonly transitions: Map<string | symbol, StateTransition>;
  /** Whether the reduction is still forbidden in this state. */
  noReduce: boolean;

  /**
   * Creates a state.
   *
   * @param rule Rule the state belongs to.
   * @param pattern Pattern of the state, or `null` for the starting node.
   * @param index Token index inside the pattern.
   */
  constructor(rule: Rule, pattern: Pattern | null = null, index: number = 0,) {
    this.rule = rule;
    this.pattern = pattern;
    this.index = index;
    this.noReduce = pattern !== null;
    this.transitions = new Map();
  }

  /**
   * Registers every transition that leaves this state.
   *
   * @param states Every state of the automaton.
   * @param rules Every rule of the grammar.
   * @param keys Map of the canonical state keys.
   */
  addTransitions(
    states: Map<string, State>,
    rules: Map<string, Rule>,
    keys: StateKeys,
  ): void {
    if (this.pattern) {
      this.pattern.addTransitionsToState(
        states,
        rules,
        keys,
        [],
        this,
        this.rule,
        this.index + 1,
        false,
      );
    } else {
      this.rule.addTransitionsToState(states, rules, keys, [], this, false,);
    }
  }

  /**
   * Adds a single transition.
   *
   * @param token Token type and text that trigger the transition.
   * @param nextState State reached after the transition.
   * @param stateStack Stack snapshot to store.
   * @param loopBack Whether the transition loops back.
   * @throws Error When another transition already uses the same token type.
   */
  addTransition(
    token: [string, string,],
    nextState: State,
    stateStack: State[],
    loopBack: boolean,
  ): void {
    const tr = new StateTransition(token, nextState, stateStack, loopBack,);
    const existing = this.transitions.get(tr.tokenType,);
    if (existing) {
      throw new Error(
        `Ambiguous transition for ${
          String(tr.tokenType,)
        } in \n${this.to_s()}\n` +
          `The following transition both match:\n` +
          `  ${tr.to_s()}\n  ${existing.to_s()}`,
      );
    }
    this.transitions.set(tr.tokenType, tr,);
  }

  /**
   * Resolves the transition for a token, trying the literal text of IDs first.
   *
   * @param token Token type and text.
   * @returns The transition, or `null` when the token is not accepted.
   */
  transition(token: [string, string,],): StateTransition | null {
    if (token[0] === "ID") {
      const literalTr = this.transitions.get(token[1],);
      if (literalTr) {
        return literalTr;
      }
      return this.transitions.get("ID",) || null;
    } else if (token[0] === "LITERAL") {
      return this.transitions.get(token[1],) || null;
    }
    return this.transitions.get(token[0],) || null;
  }

  /** Token types accepted by this state, formatted for an error message. */
  expectedTokens(): string[] {
    const tokens: string[] = [];
    this.transitions.forEach((_, t,) => {
      tokens.push(typeof t === "string" ? `'${t}'` : `:${String(t,)}`,);
    },);
    return tokens;
  }

  /**
   * Renders the state for debugging.
   *
   * @param short When true, prints only the rule/pattern/index header line.
   * @returns The textual description of the state.
   */
  to_s(short: boolean = false,): string {
    if (short) {
      if (this.pattern) {
        return `${this.rule.name} ${
          this.rule.patterns.findIndex((p,) => p === this.pattern)
        } ${this.index}`;
      }
      return `${this.rule.name} (Starting Node)`;
    }

    if (this.pattern) {
      let str = `=== State: ${this.rule.name} ` +
        `${
          this.rule.patterns.findIndex((p,) => p === this.pattern)
        } ${this.index}` +
        `${this.noReduce ? "" : " (R)"}` +
        ` ${"=".repeat(40,)}\nPattern: ${this.pattern.to_s()}\n`;
      this.transitions.forEach((target, type,) => {
        const targetStr = target ? target.to_s() : "<EOF>";
        str +=
          `  ${typeof type === "string" ? `'${type}'` : `:${String(type,)}`}` +
          ` => ${targetStr}\n`;
      },);
      str += `${"=".repeat(76,)}\n`;
      return str;
    }

    let str = `=== State: ${this.rule.name} (Starting Node) ${
      "=".repeat(30,)
    }\n`;
    this.transitions.forEach((target, type,) => {
      const targetStr = target ? target.to_s() : "<EOF>";
      str +=
        `  ${typeof type === "string" ? `'${type}'` : `:${String(type,)}`}` +
        ` => ${targetStr}\n`;
    },);
    str += `${"=".repeat(76,)}\n`;
    return str;
  }
}
