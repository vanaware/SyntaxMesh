import { type TokenDoc, } from "../lexer/token-doc.ts";
import { State, stateKeyOf, type StateKeys, } from "./state.ts";
import { Rule, } from "./rule.ts";

export type TokenType = "reference" | "variable" | "literal" | "eof";
export type Token = [TokenType, string,];

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

  constructor(
    tokens: string[],
    fn: ((...args: unknown[]) => unknown) | null = null,
  ) {
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
      if (!"!$_.".includes(prefix,)) {
        throw new Error(
          `Fatal Error: All pattern tokens must start with a type identifier [!$_.]: ${
            tokens.join(", ",)
          }`,
        );
      }
      const typeIndex = "!$_.".indexOf(prefix,)!;
      const type =
        (["reference", "variable", "literal", "eof",] as const)[typeIndex]!;
      const name = type === "literal"
        ? token.slice(1,)
        : type === "eof"
        ? "<END>"
        : token.slice(1,);
      this.tokens.push([type, name,],);
      this.args.push(null,);
    }
    this.function = fn;
    this.lastSyntaxToken = this.tokens.length - 1;
  }

  generateStates(rule: Rule, rules: Map<string, Rule>,): State[] {
    let firstReduceableToken = this.tokens.length - 1;
    for (let i = this.tokens.length - 2; i >= 0; i--) {
      if (this.optionalToken(i + 1, rules,)) {
        firstReduceableToken = i;
      } else {
        break;
      }
    }

    const states: State[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      const state = new State(rule, this, i,);
      // Port fiel: em Ruby, `state.noReduce = false if i >= firstReduceableToken`
      if (i >= firstReduceableToken) {
        state.noReduce = false;
      }
      states.push(state,);
    }
    return states;
  }

  addTransitionsToState(
    states: Map<string, State>,
    rules: Map<string, Rule>,
    keys: StateKeys,
    stateStack: State[],
    sourceState: State,
    destRule: Rule,
    destIndex: number,
    loopBack: boolean,
  ): void {
    let destIndexLocal = destIndex;
    while (true) {
      if (destIndexLocal >= this.tokens.length) {
        if (sourceState.rule === destRule) {
          if (destRule.repeatable) {
            destRule.addTransitionsToState(
              states,
              rules,
              keys,
              [],
              sourceState,
              true,
            );
          }
        }
        return;
      }

      const tokenType = this.tokens[destIndexLocal]![0];
      const tokenName = this.tokens[destIndexLocal]![1];

      if (tokenType === "reference") {
        const refRule = rules.get(tokenName,);
        if (!refRule) {
          throw new Error(
            `Unknown rule ${tokenName} referenced in rule ${destRule.name}`,
          );
        }
        const skippedState = states.get(
          stateKeyOf(destRule, this, destIndexLocal, keys,),
        );
        // Regras podem referenciar a si mesmas direta ou indiretamente; a
        // proteção contra recursão infinita é o stateStack (Ruby l.181). O
        // estado "pulada" é empilhado antes e desapertado depois da
        // resolução da referência.
        if (skippedState && !stateStack.some((s,) => s === skippedState)) {
          stateStack.push(skippedState,);
          refRule.addTransitionsToState(
            states,
            rules,
            keys,
            stateStack,
            sourceState,
            loopBack,
          );
          stateStack.pop();
        }
        if (!refRule.optional(rules,)) {
          break;
        }
      } else {
        const destState = states.get(
          stateKeyOf(destRule, this, destIndexLocal, keys,),
        );
        if (!destState) {
          throw new Error(
            `Destination state not found for rule ${destRule.name}, pattern ${
              this.keyword ?? "<no-keyword>"
            }, index ${destIndexLocal}`,
          );
        }
        sourceState.addTransition(
          [tokenType, tokenName,],
          destState,
          stateStack,
          loopBack,
        );
        break;
      }
      destIndexLocal += 1;
    }
  }

  setDoc(keyword: string, doc: string,): void {
    this.keyword = keyword;
    this.doc = doc;
  }

  setArg(idx: number, doc: TokenDoc | null,): void {
    this.args[idx] = doc;
  }

  setLastSyntaxToken(idx: number,): void {
    this.lastSyntaxToken = idx;
  }

  setSupportLevel(level: string,): void {
    this.supportLevel = level;
  }

  setSeeAlso(also: string[],): void {
    this.seeAlso = also;
  }

  setExample(file: string, tag: string,): void {
    this.exampleFile = file;
    this.exampleTag = tag;
  }

  get(i: number,): Token {
    const t = this.tokens[i];
    if (!t) {
      throw new Error(`Token index out of range: ${i}`,);
    }
    return t;
  }

  each(): IterableIterator<[TokenType, string,]> {
    return this.tokens[Symbol.iterator]() as IterableIterator<
      [TokenType, string,]
    >;
  }

  empty(): boolean {
    return this.tokens.length === 0;
  }

  length(): number {
    return this.tokens.length;
  }

  optional(rules: Map<string, Rule>,): boolean {
    for (const token of this.tokens) {
      const type = token[0];
      const name = token[1];
      if (type === "literal" || type === "variable") {
        return false;
      } else if (type === "reference") {
        const refRule = rules.get(name,);
        if (!refRule || !refRule.optional(rules,)) {
          return false;
        }
      }
    }
    return true;
  }

  private optionalToken(index: number, rules: Map<string, Rule>,): boolean {
    const token = this.tokens[index];
    if (!token) {
      return false;
    }
    if (token[0] === "reference") {
      const refRule = rules.get(token[1],);
      if (!refRule) {
        return false;
      }
      return refRule.optional(rules,);
    }
    return false;
  }

  terminalSymbol(i: number,): boolean {
    const token = this.tokens[i];
    if (!token) {
      return false;
    }
    const type = token[0];
    return type === "variable" || type === "literal";
  }

  terminalTokens(
    rules: Map<string, Rule>,
    index: number = 0,
  ): Array<[string, Pattern,]> {
    const token = this.tokens[index];
    if (!token) {
      throw new Error(`Token index out of range: ${index}`,);
    }
    const type = token[0];
    const name = token[1];
    if (type === "literal") {
      return [[name, this,],];
    } else if (type === "variable") {
      return [];
    } else if (type === "reference") {
      const rule = rules.get(name,);
      if (!rule) {
        throw new Error(`Unknown rule ${name} referenced in terminalTokens`,);
      }
      const tts: Array<[string, Pattern,]> = [];
      for (const p of rule.patterns) {
        tts.push(...p.terminalTokens(rules, 0,),);
      }
      return tts;
    }
    throw new Error(`Unexpected token ${type} ${name}`,);
  }

  to_syntax(
    argDocs: Array<TokenDoc>,
    rules: Map<string, Rule>,
    skip: number = 0,
  ): string {
    const stack = new Map<unknown, boolean>();
    return this.to_syntax_r(stack, argDocs, rules, skip,);
  }

  to_syntax_r(
    stack: Map<unknown, boolean>,
    argDocs: Array<TokenDoc>,
    rules: Map<string, Rule>,
    skip: number,
  ): string {
    const selfRef = this as unknown as object;
    if (stack.has(selfRef,)) {
      return "[, ... ]";
    }
    stack.set(selfRef, true,);

    let str = "";
    let first = true;
    for (let i = skip; i <= this.lastSyntaxToken; i++) {
      const token = this.tokens[i];
      if (!token) {
        throw new Error(`Token index out of range: ${i}`,);
      }
      const type = token[0];
      const name = token[1];
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
        const argDocName = argDoc.name;
        if (!argDocName) {
          str += `${name}`;
          (argDoc as TokenDoc & { name?: string }).name = name;
        } else {
          str += `<${argDocName}>`;
        }
        if (!argDocs.some((ad,) => ad.name === argDoc.name)) {
          argDocs.push(argDoc,);
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
            const refRule = rules.get(name,);
            if (!refRule) {
              throw new Error(
                `Unknown rule ${name} referenced in to_syntax_r`,
              );
            }
            // Guarda anti-ciclo: referência a regra já em processamento.
            if (stack.has(refRule,)) {
              str += `<${name}, ...>`;
              break;
            }
            stack.set(refRule, true,);
            const firstPattern = refRule.patterns[0];
            if (!firstPattern) {
              stack.delete(refRule,);
              throw new Error(`Rule ${name} has no patterns`,);
            }
            str += `<${firstPattern.keyword}>`;
            stack.delete(refRule,);
            break;
          }
        }
      }
    }
    stack.delete(selfRef,);
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
          throw new Error(`Unknown type ${type}`,);
      }
    }
    return str;
  }

  private addArgDoc(argDocs: Array<TokenDoc>, argDoc: TokenDoc,): void {
    for (const ad of argDocs) {
      if (ad.name === argDoc.name) {
        return;
      }
    }
    argDocs.push(argDoc,);
  }
}
