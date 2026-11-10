import { TokenDoc, } from "../lexer/token-doc.ts";
import { State, stateKeyOf, type StateKeys, } from "./state.ts";
import { Rule, } from "./rule.ts";

/** Kind of symbol a pattern token stands for. */
export type TokenType = "reference" | "variable" | "literal" | "eof";

/** Token of a pattern: its kind and its text (or the referenced rule name). */
export type Token = [TokenType, string,];

/**
 * Pattern — one alternative of a grammar rule, written as a list of prefixed
 * tokens: `!rule` (reference to another rule), `$var` (value), `_literal` or
 * plain text (literal) and `.` (end of input).
 *
 * Port of `TextParser/Pattern.rb`. A pattern also carries the documentation of
 * the keyword it describes (`keyword`, `doc`, `supportLevel`, `seeAlso`,
 * examples) and the states built from it by the automaton.
 */
export class Pattern {
  /** Keyword documented by this pattern, or `null`. */
  keyword: string | null;
  /** Documentation text of the keyword, or `null`. */
  doc: string | null;
  /** Support level of the keyword (`supported`, `deprecated`, …). */
  supportLevel: string;
  /** Keywords to see also. */
  seeAlso: string[];
  /** File of the documentation example. */
  exampleFile: string | null;
  /** Tag of the example inside `exampleFile`. */
  exampleTag: string | null;
  /** Tokens of the pattern, in grammar order. */
  tokens: Token[];
  /** Interpreter hook executed when the pattern is reduced. */
  function: ((...args: unknown[]) => unknown) | null;
  /** Documentation of each token, index-aligned with `tokens`. */
  args: Array<TokenDoc | null>;
  /** Index of the last token that belongs to the syntax. */
  lastSyntaxToken: number;
  /** Transitions registered for this pattern. */
  transitions: unknown[];

  /**
   * Builds a pattern from its prefixed token list.
   *
   * @param tokens Tokens, each starting with `!`, `$`, `_` or `.`.
   * @param fn Interpreter hook, when the pattern reduces to a value.
   * @throws Error When a token does not start with a known type prefix.
   */
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

  /**
   * Creates the automaton states of this pattern.
   *
   * @param rule Rule that owns the pattern.
   * @param rules Every rule of the grammar, for the optionality check.
   * @returns One state per token, in grammar order.
   */
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
      // Faithful port: in Ruby, `state.noReduce = false if i >= firstReduceableToken`
      if (i >= firstReduceableToken) {
        state.noReduce = false;
      }
      states.push(state,);
    }
    return states;
  }

  /**
   * Adds the transitions that leave `sourceState` through this pattern, starting
   * at `destIndex`.
   *
   * @param states Every state of the automaton, keyed by `stateKeyOf`.
   * @param rules Every rule of the grammar.
   * @param keys Lookahead keys accepted by the source state.
   * @param stateStack Stack used to break the recursion between rules.
   * @param sourceState State that receives the transitions.
   * @param destRule Rule that owns this pattern.
   * @param destIndex Index of the first token to consume.
   * @param loopBack Whether the transition loops back to a previous state.
   */
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
        // Rules may reference themselves directly or indirectly; the guard
        // against infinite recursion is the stateStack (Ruby l.181). The
        // "skipped" state is pushed before and popped after the reference is
        // resolved.
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

  /**
   * Records the keyword and its documentation.
   *
   * @param keyword Keyword described by this pattern.
   * @param doc Documentation text.
   */
  setDoc(keyword: string, doc: string,): void {
    this.keyword = keyword;
    this.doc = doc;
  }

  /**
   * Sets the documentation of one token.
   *
   * @param idx Index of the token.
   * @param doc Documentation of the token, or `null` to clear it.
   */
  setArg(idx: number, doc: TokenDoc | null,): void {
    this.args[idx] = doc;
  }

  /**
   * Sets the index of the last token that belongs to the syntax.
   *
   * @param idx Index of the token.
   */
  setLastSyntaxToken(idx: number,): void {
    this.lastSyntaxToken = idx;
  }

  /**
   * Sets the support level of the keyword.
   *
   * @param level One of the support-level strings.
   */
  setSupportLevel(level: string,): void {
    this.supportLevel = level;
  }

  /**
   * Sets the "see also" keywords.
   *
   * @param also Keywords to list as related.
   */
  setSeeAlso(also: string[],): void {
    this.seeAlso = also;
  }

  /**
   * Sets the documentation example of the keyword.
   *
   * @param file File that holds the example.
   * @param tag Tag of the example inside the file.
   */
  setExample(file: string, tag: string | null,): void {
    this.exampleFile = file;
    this.exampleTag = tag;
  }

  /**
   * Token at an index.
   *
   * @param i Index of the token.
   * @returns The token.
   * @throws Error When the index is out of range.
   */
  get(i: number,): Token {
    const t = this.tokens[i];
    if (!t) {
      throw new Error(`Token index out of range: ${i}`,);
    }
    return t;
  }

  /** Iterates over the tokens of the pattern. */
  each(): IterableIterator<[TokenType, string,]> {
    return this.tokens[Symbol.iterator]() as IterableIterator<
      [TokenType, string,]
    >;
  }

  /** Whether the pattern has no tokens at all. */
  empty(): boolean {
    return this.tokens.length === 0;
  }

  /** Number of tokens of the pattern. */
  length(): number {
    return this.tokens.length;
  }

  /**
   * Whether every token of the pattern can be omitted, so the pattern matches
   * the empty input.
   *
   * @param rules Every rule of the grammar, for the reference tokens.
   * @returns `true` when the pattern is entirely optional.
   */
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

  /**
   * Whether the token at an index is a reference to an optional rule.
   *
   * @param index Index of the token.
   * @param rules Every rule of the grammar.
   * @returns `true` when the token is an optional reference.
   */
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

  /**
   * Whether the token at an index is a terminal symbol (variable or literal).
   *
   * @param i Index of the token.
   * @returns `true` for `variable` and `literal` tokens.
   */
  terminalSymbol(i: number,): boolean {
    const token = this.tokens[i];
    if (!token) {
      return false;
    }
    const type = token[0];
    return type === "variable" || type === "literal";
  }

  /**
   * Terminal tokens reachable from the token at an index.
   *
   * @param rules Every rule of the grammar.
   * @param index Index of the starting token.
   * @returns Pairs of literal text and the pattern that owns it.
   * @throws Error When the token index or a referenced rule is unknown.
   */
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

  /**
   * Renders the syntax of the pattern for the documentation.
   *
   * @param argDocs Collector that receives the argument documentation.
   * @param rules Every rule of the grammar.
   * @param skip Number of leading tokens to skip.
   * @returns The syntax string (e.g. `task <id> { <attributes> }`).
   */
  to_syntax(
    argDocs: Array<TokenDoc>,
    rules: Map<string, Rule>,
    skip: number = 0,
  ): string {
    const stack = new Map<unknown, boolean>();
    return this.to_syntax_r(stack, argDocs, rules, skip,);
  }

  /**
   * Recursive body of `to_syntax`, with the cycle guard in `stack`.
   *
   * @param stack Patterns already being rendered, to cut recursion.
   * @param argDocs Collector that receives the argument documentation.
   * @param rules Every rule of the grammar.
   * @param skip Number of leading tokens to skip.
   * @returns The syntax string.
   */
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
            const firstPattern = refRule.patterns[0];
            if (!firstPattern) {
              throw new Error(`Rule ${name} has no patterns`,);
            }
            // A rule with a single documented pattern is already a keyword: it
            // becomes an argument (`<keyword>`) instead of being expanded.
            if (
              refRule.patterns.length === 1 && firstPattern.doc !== null
            ) {
              this.addArgDoc(
                argDocs,
                new TokenDoc(firstPattern.keyword, firstPattern,),
              );
              str += `<${firstPattern.keyword}>`;
            } else {
              // The other references are followed recursively
              // (`Pattern.rb:379`); the cycle guard lives in the pattern itself.
              str += refRule.to_syntax(stack, argDocs, rules, 0,);
            }
            break;
          }
        }
      }
    }
    stack.delete(selfRef,);
    return str;
  }

  /** Renders the pattern in the internal `!rule $var _literal .` notation. */
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

  /**
   * Adds an argument documentation unless one with the same name is there.
   *
   * @param argDocs Collector of the argument documentation.
   * @param argDoc Documentation to add.
   */
  private addArgDoc(argDocs: Array<TokenDoc>, argDoc: TokenDoc,): void {
    for (const ad of argDocs) {
      if (ad.name === argDoc.name) {
        return;
      }
    }
    argDocs.push(argDoc,);
  }
}
