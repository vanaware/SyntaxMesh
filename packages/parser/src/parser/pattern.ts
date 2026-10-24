import { type TokenDoc } from "../lexer/token-doc.ts";
import { State } from "./state.ts";
import { Rule } from "./rule.ts";

export type TokenType = "reference" | "variable" | "literal" | "eof";
export type Token = [TokenType, string];

export class Pattern {
  keyword: string | null;
  doc: string | null;
  supportLevel: string;
  seeAlso: string[];
  exampleFile: string | null;
  exampleTag: string | null;
  tokens: Token[];
  function: ((...args: unknown[]) => unknown) | null;
  args: Array<TokenDoc | null>;
  lastSyntaxToken: number;
  transitions: unknown[];

  constructor(tokens: string[], fn: ((...args: unknown[]) => unknown) | null = null) {
    this.keyword = null;
    this.doc = null;
    this.supportLevel = "supported";
    this.seeAlso = [];
    this.exampleFile = null;
    this.exampleTag = null;
    this.tokens = [];
    this.args = [];
    this.transitions = [];
    for (const token of tokens) {
      const prefix = token[0]!;
      if (!"!$_.".includes(prefix)) {
        throw new Error(
          `Fatal Error: All pattern tokens must start with a type identifier [!$_.]: ${tokens.join(", ")}`
        );
      }
      const typeIndex = "!$_.".indexOf(prefix)!;
      const type = (["reference", "variable", "literal", "eof"] as const)[typeIndex];
      const name = type === "literal" ? token.slice(1) : type === "eof" ? "<END>" : token.slice(1);
      this.tokens.push([type, name]);
      this.args.push(null);
    }
    this.function = fn;
    this.lastSyntaxToken = this.tokens.length - 1;
  }

  generateStates(rule: Rule, rules: Map<string, Rule>): State[] {
    let firstReduceableToken = this.tokens.length - 1;
    for (let i = this.tokens.length - 2; i >= 0; i--) {
      if (this.optionalToken(i + 1, rules)) {
        firstReduceableToken = i;
      } else {
        break;
      }
    }

    const states: State[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      const state = new State(rule, this, i);
      state.noReduce = i >= firstReduceableToken;
      states.push(state);
    }
    return states;
  }

  addTransitionsToState(
    states: Map<string, State>,
    rules: Map<string, Rule>,
    stateStack: State[],
    sourceState: State,
    destRule: Rule,
    destIndex: number,
    loopBack: boolean
  ): void {
    let destIndexLocal = destIndex;
    while (true) {
      if (destIndexLocal >= this.tokens.length) {
        if (sourceState.rule.name === destRule.name) {
          if (destRule.repeatable) {
            destRule.addTransitionsToState(states, rules, [], sourceState, true);
          }
        }
        return;
      }

      const tokenType = this.tokens[destIndexLocal][0];
      const tokenName = this.tokens[destIndexLocal][1];

      if (tokenType === "reference") {
        const refRule = rules[tokenName];
        const skippedState = states.get(this.stateKey(destRule, this, destIndexLocal) as string);
        if (skippedState) {
          const stack = [...stateStack, skippedState];
          refRule.addTransitionsToState(states, rules, stack, sourceState, loopBack);
          if (!refRule.optional(rules)) {
            break;
          }
        }
      } else {
        const destState = states.get(this.stateKey(destRule, this, destIndexLocal) as string);
        sourceState.addTransition(this.tokens[destIndexLocal], destState, stateStack, loopBack);
        break;
      }
      destIndexLocal += 1;
    }
  }

  private stateKey(rule: Rule, pattern: Pattern, index: number): string {
    return JSON.stringify([rule.name, pattern ? pattern.keyword : null, index]);
  }

  setDoc(keyword: string, doc: string): void {
    this.keyword = keyword;
    this.doc = doc;
  }

  setArg(idx: number, doc: TokenDoc | null): void {
    this.args[idx] = doc;
  }

  setLastSyntaxToken(idx: number): void {
    this.lastSyntaxToken = idx;
  }

  setSupportLevel(level: string): void {
    this.supportLevel = level;
  }

  setSeeAlso(also: string[]): void {
    this.seeAlso = also;
  }

  setExample(file: string, tag: string): void {
    this.exampleFile = file;
    this.exampleTag = tag;
  }

  get(i: number): Token {
    return this.tokens[i];
  }

  each(): IterableIterator<[TokenType, string]> {
    return this.tokens[Symbol.iterator]() as IterableIterator<[TokenType, string]>;
  }

  empty(): boolean {
    return this.tokens.length === 0;
  }

  length(): number {
    return this.tokens.length;
  }

  optional?(rules: Map<string, Rule>): boolean {
    for (const token of this.tokens) {
      const type = token[0];
      const name = token[1];
      if (type === "literal" || type === "variable") {
        return false;
      } else if (type === "reference") {
        const refRule = rules[name];
        if (!refRule.optional(rules)) {
          return false;
        }
      }
    }
    return true;
  }

  private optionalToken(index: number, rules: Map<string, Rule>): boolean {
    const token = this.tokens[index];
    if (token[0] === "reference") {
      const refRule = rules[token[1]];
      return refRule.optional(rules);
    }
    return false;
  }

  terminalSymbol?(i: number): boolean {
    const type = this.tokens[i][0];
    return type === "variable" || type === "literal";
  }

  terminalTokens(rules: Map<string, Rule>, index: number = 0): Array<[string, Pattern]> {
    const type = this.tokens[index][0];
    const name = this.tokens[index][1];
    if (type === "literal") {
      return [[name, this]];
    } else if (type === "variable") {
      return [];
    } else if (type === "reference") {
      const rule = rules[name];
      const tts: Array<[string, Pattern]> = [];
      for (const p of rule.patterns) {
        tts.push(...p.terminalTokens(rules, 0));
      }
      return tts;
    }
    throw new Error(`Unexpected token ${type} ${name}`);
  }

  to_syntax(argDocs: Array<TokenDoc>, rules: Map<string, Rule>, skip: number = 0): string {
    const stack = new Map<unknown, boolean>();
    return this.to_syntax_r(stack, argDocs, rules, skip);
  }

  to_syntax_r(stack: Map<unknown, boolean>, argDocs: Array<TokenDoc>, rules: Map<string, Rule>, skip: number): string {
    const selfRef = this as unknown as Record<string, boolean>;
    if (stack[selfRef]) {
      return "[, ... ]";
    }
    stack[selfRef] = true;

    let str = "";
    let first = true;
    for (let i = skip; i <= this.lastSyntaxToken; i++) {
      const type = this.tokens[i][0];
      const name = this.tokens[i][1];
      if (first) {
        first = false;
        if (name === "{") {
          return "{ <attributes> }";
        }
      } else {
        str += " ";
      }

      if (this.args[i]) {
        const argDoc = this.args[i]!;
        if (!argDoc.name) {
          str += `${name}`;
          argDoc.name = name;
        } else {
          str += `<${argDoc.name}>`;
        }
        if (!argDocs.some((ad) => ad.name === argDoc.name)) {
          argDocs.push(argDoc);
        }
        if (type === "variable") {
          (argDoc as TokenDoc & { typeSpec?: string }).typeSpec = `<${name}>`;
        }
      } else {
        switch (type) {
          case "literal":
            str += name;
            break;
          case "variable":
            str += `<${name}>`;
            break;
          case "reference": {
            const refRule = rules[name];
            str += `<${refRule.patterns[0].keyword}>`;
            break;
          }
        }
      }
    }
    delete stack[selfRef];
    return str;
  }

  to_s(): string {
    let str = "";
    for (const token of this.tokens) {
      const type = token[0];
      const name = token[1];
      switch (type) {
        case "reference":
          str += `!${name} `;
          break;
        case "variable":
          str += `$${name} `;
          break;
        case "literal":
          str += `${name} `;
          break;
        case "eof":
          str += `. `;
          break;
        default:
          throw new Error(`Unknown type ${type}`);
      }
    }
    return str;
  }

  private addArgDoc(argDocs: Array<TokenDoc>, argDoc: TokenDoc): void {
    for (const ad of argDocs) {
      if (ad.name === argDoc.name) {
        return;
      }
    }
    argDocs.push(argDoc);
  }
}
