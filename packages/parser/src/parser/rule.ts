import { type Pattern } from "./pattern.ts";
import { type State } from "./state.ts";
import { type StateKey } from "./state.ts";

export class Rule {
  readonly name: string;
  patterns: Pattern[];
  optional: boolean;
  repeatable: boolean;
  keyword: string | null;
  doc: string | null;
  transitiveOptional: boolean | null;
  transitions: unknown[];

  constructor(name: string) {
    this.name = name;
    this.patterns = [];
    this.repeatable = false;
    this.optional = false;
    this.keyword = null;
    this.transitions = [];
    this.transitiveOptional = null;
    this.flushCache();
  }

  flushCache(): void {
    this.transitiveOptional = null;
  }

  addPattern(pattern: Pattern): void {
    this.patterns.push(pattern);
  }

  include?(token: string): boolean {
    for (const p of this.patterns) {
      for (const [type, name] of p.each()) {
        if (name === token) {
          return true;
        }
      }
    }
    return false;
  }

  setOptional(): void {
    this.optional = true;
  }

  optional?(rules: Map<string, Rule>): boolean {
    if (this.transitiveOptional !== null) {
      return this.transitiveOptional;
    }
    if (this.optional) {
      this.transitiveOptional = true;
      return true;
    }
    this.transitiveOptional = true;
    for (const pat of this.patterns) {
      if (!pat.optional?.(rules)) {
        this.transitiveOptional = false;
        return false;
      }
    }
    return true;
  }

  generateStates(rules: Map<string, Rule>): State[] {
    const states: State[] = [new State(this)];
    for (const pattern of this.patterns) {
      states.push(...pattern.generateStates(this, rules));
    }
    return states;
  }

  addTransitionsToState(
    states: Map<StateKey, State>,
    rules: Map<string, Rule>,
    stateStack: State[],
    sourceState: State,
    loopBack: boolean
  ): void {
    for (const pattern of this.patterns) {
      pattern.addTransitionsToState(
        states,
        rules,
        [...stateStack],
        sourceState,
        this,
        0,
        loopBack
      );
    }
  }

  setRepeatable(): void {
    this.repeatable = true;
  }

  setDoc(keyword: string, doc: string): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setDoc(keyword, doc);
  }

  setArg(idx: number, doc: Pattern | null): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setArg(idx, doc);
  }

  setLastSyntaxToken(idx: number): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setLastSyntaxToken(idx);
  }

  setSupportLevel(level: string): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setSupportLevel(level);
  }

  setSeeAlso(also: string[]): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setSeeAlso(also);
  }

  setExample(file: string, tag: string): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet");
    }
    this.patterns[this.patterns.length - 1].setExample(file, tag);
  }

  pattern(idx: number): Pattern {
    return this.patterns[idx];
  }

  to_syntax(stack: Map<unknown, boolean>, docs: Array<unknown>, rules: Map<string, Rule>, skip: number = 0): string {
    let str = "";
    if (this.optional || this.repeatable) {
      str += "[";
    }
    if (this.patterns.length > 1) {
      str += "(";
    }
    let first = true;
    let pStr = "";
    for (const pat of this.patterns) {
      if (first) {
        first = false;
      } else {
        pStr += " | ";
      }
      pStr += pat.to_syntax_r(stack, docs as Array<unknown>, rules, skip);
    }
    if (pStr === "") {
      return "";
    }
    str += pStr;
    if (this.repeatable) {
      str += "...";
    }
    if (this.patterns.length > 1) {
      str += ")";
    }
    if (this.optional || this.repeatable) {
      str += "]";
    }
    return str;
  }
}