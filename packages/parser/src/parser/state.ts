import { Pattern } from "./pattern.ts";
import { Rule } from "./rule.ts";

/**
 * StateKey — identificador único para um State no FSM.
 * [ruleName, patternName|null, index]
 */
export type StateKey = [string, string | null, number];

/**
 * StateTransition — mapeia um tipo de token para o próximo state.
 */
export class StateTransition {
  readonly tokenType: string | symbol;
  readonly state: State;
  readonly stateStack: State[];
  readonly loopBack: boolean;

  constructor(
    descriptor: [string, string],
    state: State,
    stateStack: State[],
    loopBack: boolean
  ) {
    if (!descriptor || descriptor.length !== 2) {
      throw new Error(
        `Bad parameter descriptor: ${descriptor} of type ${typeof descriptor}`
      );
    }
    this.tokenType = descriptor[0] === "eof" ? "eof" : descriptor[1];

    if (!(state instanceof State)) {
      throw new Error(`Bad parameter state: ${state} of type ${typeof state}`);
    }
    this.state = state;

    if (!Array.isArray(stateStack)) {
      throw new Error(
        `Bad parameter stateStack: ${stateStack} of type ${typeof stateStack}`
      );
    }
    this.stateStack = [...stateStack];
    this.loopBack = loopBack;
  }

  to_s(): string {
    let str = `${this.state.rule.name}, ` +
      `${this.state.rule.patterns.findIndex((p) => p === this.state.pattern)}, ` +
      `${this.state.index} `;
    if (this.stateStack.length > 0) {
      str += "(";
      this.stateStack.forEach((s) => {
        str += `${s.rule.name} `;
      });
      str += ")";
    }
    if (this.loopBack) {
      str += "(loop)";
    }
    return str;
  }
}

/**
 * State — descreve um estado do TextParser FSM.
 */
export class State {
  readonly rule: Rule;
  readonly pattern: Pattern | null;
  readonly index: number;
  readonly transitions: Map<string | symbol, StateTransition>;
  noReduce: boolean;

  constructor(rule: Rule, pattern: Pattern | null = null, index: number = 0) {
    this.rule = rule;
    this.pattern = pattern;
    this.index = index;
    this.noReduce = pattern !== null;
    this.transitions = new Map();
  }

  addTransitions(states: Map<StateKey, State>, rules: Map<string, Rule>): void {
    if (this.pattern) {
      this.pattern.addTransitionsToState(
        states,
        rules,
        [],
        this,
        this.rule,
        this.index + 1,
        false
      );
    } else {
      this.rule.addTransitionsToState(states, rules, [], this, false);
    }
  }

  addTransition(
    token: [string, string],
    nextState: State,
    stateStack: State[],
    loopBack: boolean
  ): void {
    const tr = new StateTransition(token, nextState, stateStack, loopBack);
    const existing = this.transitions.get(tr.tokenType);
    if (existing) {
      throw new Error(
        `Ambiguous transition for ${String(tr.tokenType)} in \n${this.to_s()}\n` +
          `The following transition both match:\n` +
          `  ${tr.to_s()}\n  ${existing.to_s()}`
      );
    }
    this.transitions.set(tr.tokenType, tr);
  }

  transition(token: [string, string]): StateTransition | null {
    if (token[0] === "ID") {
      const literalTr = this.transitions.get(token[1]);
      if (literalTr) {
        return literalTr;
      }
      return this.transitions.get("ID") || null;
    } else if (token[0] === "LITERAL") {
      return this.transitions.get(token[1]) || null;
    }
    return this.transitions.get(token[0]) || null;
  }

  expectedTokens(): string[] {
    const tokens: string[] = [];
    this.transitions.forEach((_, t) => {
      tokens.push(typeof t === "string" ? `'${t}'` : `:${String(t)}`);
    });
    return tokens;
  }

  to_s(short: boolean = false): string {
    if (short) {
      if (this.pattern) {
        return `${this.rule.name} ${this.rule.patterns.findIndex((p) => p === this.pattern)} ${this.index}`;
      }
      return `${this.rule.name} (Starting Node)`;
    }

    if (this.pattern) {
      let str = `=== State: ${this.rule.name} ` +
        `${this.rule.patterns.findIndex((p) => p === this.pattern)} ${this.index}` +
        `${this.noReduce ? "" : " (R)"}` +
        ` ${"=".repeat(40)}\nPattern: ${this.pattern.to_s()}\n`;
      this.transitions.forEach((target, type) => {
        const targetStr = target ? target.to_s() : "<EOF>";
        str += `  ${typeof type === "string" ? `'${type}'` : `:${String(type)}`}` +
          ` => ${targetStr}\n`;
      });
      str += `${"=".repeat(76)}\n`;
      return str;
    }

    let str = `=== State: ${this.rule.name} (Starting Node) ${"=".repeat(30)}\n`;
    this.transitions.forEach((target, type) => {
      const targetStr = target ? target.to_s() : "<EOF>";
      str += `  ${typeof type === "string" ? `'${type}'` : `:${String(type)}`}` +
        ` => ${targetStr}\n`;
    });
    str += `${"=".repeat(76)}\n`;
    return str;
  }
}
