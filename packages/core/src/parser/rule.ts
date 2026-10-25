import { type Pattern, } from "./pattern.ts";
import { State, type StateKeys, } from "./state.ts";
import { type StateKey, } from "./state.ts";
import { type TokenDoc, } from "../lexer/token-doc.ts";

export class Rule {
  readonly name: string;
  patterns: Pattern[];
  isOptional: boolean;
  repeatable: boolean;
  keyword: string | null;
  doc: string | null;
  transitiveOptional: boolean | null;
  transitions: unknown[];

  constructor(name: string,) {
    this.name = name;
    this.patterns = [];
    this.repeatable = false;
    this.isOptional = false;
    this.keyword = null;
    this.doc = null;
    this.transitions = [];
    this.transitiveOptional = null;
    this.flushCache();
  }

  flushCache(): void {
    this.transitiveOptional = null;
  }

  addPattern(pattern: Pattern,): void {
    this.patterns.push(pattern,);
  }

  includes(token: string,): boolean {
    // Port fiel de Rule#include?: compara apenas o nome do 1º token.
    for (const p of this.patterns) {
      const first = p.length() > 0 ? p.get(0,) : null;
      if (first && first[1] === token) {
        return true;
      }
    }
    return false;
  }

  setOptional(): void {
    this.isOptional = true;
  }

  optional(rules: Map<string, Rule>,): boolean {
    if (this.transitiveOptional !== null) {
      return this.transitiveOptional;
    }
    if (this.isOptional) {
      this.transitiveOptional = true;
      return true;
    }
    this.transitiveOptional = true;
    for (const pat of this.patterns) {
      if (!pat.optional(rules,)) {
        this.transitiveOptional = false;
        return false;
      }
    }
    return true;
  }

  generateStates(rules: Map<string, Rule>,): State[] {
    const states: State[] = [new State(this,),];
    for (const pattern of this.patterns) {
      states.push(...pattern.generateStates(this, rules,),);
    }
    return states;
  }

  addTransitionsToState(
    states: Map<string, State>,
    rules: Map<string, Rule>,
    keys: StateKeys,
    stateStack: State[],
    sourceState: State,
    loopBack: boolean,
  ): void {
    for (const pattern of this.patterns) {
      pattern.addTransitionsToState(
        states,
        rules,
        keys,
        [...stateStack,],
        sourceState,
        this,
        0,
        loopBack,
      );
    }
  }

  setRepeatable(): void {
    this.repeatable = true;
  }

  setDoc(keyword: string, doc: string,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setDoc(keyword, doc,);
  }

  setArg(idx: number, doc: TokenDoc | null,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setArg(idx, doc,);
  }

  setLastSyntaxToken(idx: number,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setLastSyntaxToken(idx,);
  }

  setSupportLevel(level: string,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setSupportLevel(level,);
  }

  setSeeAlso(also: string[],): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setSeeAlso(also,);
  }

  setExample(file: string, tag: string,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setExample(file, tag,);
  }

  pattern(idx: number,): Pattern {
    const p = this.patterns[idx];
    if (!p) {
      throw new Error(`Pattern ${idx} not found in rule ${this.name}`,);
    }
    return p;
  }

  to_syntax(
    stack: Map<unknown, boolean>,
    docs: Array<TokenDoc>,
    rules: Map<string, Rule>,
    skip: number = 0,
  ): string {
    // Guarda anti-ciclo: regras recursivas (ex.: logicalExpression) não
    // devem causar pilha infinita na serialização.
    if (stack.has(this,)) {
      return "[, ... ]";
    }
    stack.set(this, true,);
    let str = "";
    if (this.isOptional || this.repeatable) {
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
      pStr += pat.to_syntax_r(stack, docs, rules, skip,);
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
    if (this.isOptional || this.repeatable) {
      str += "]";
    }
    stack.delete(this,);
    return str;
  }
}
