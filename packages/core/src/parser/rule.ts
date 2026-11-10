import { type Pattern, } from "./pattern.ts";
import { State, type StateKeys, } from "./state.ts";
import { type StateKey, } from "./state.ts";
import { type TokenDoc, } from "../lexer/token-doc.ts";

/**
 * Rule — a named non-terminal of the grammar, holding its alternative patterns
 * and the documentation of the keyword it defines.
 *
 * Port of `TextParser/Rule.rb`. The rule also caches whether it is transitively
 * optional (`transitiveOptional`), so the automaton builder does not walk the
 * same graph twice.
 */
export class Rule {
  /** Name used by `!name` references. */
  readonly name: string;
  /** Alternative patterns of the rule, in declaration order. */
  patterns: Pattern[];
  /** Whether the rule was explicitly marked as optional (`[ ... ]`). */
  isOptional: boolean;
  /** Whether the rule may repeat (`...`). */
  repeatable: boolean;
  /** Keyword documented by the rule, or `null`. */
  keyword: string | null;
  /** Documentation text of the keyword, or `null`. */
  doc: string | null;
  /** Cached answer of `optional()`, or `null` when it still has to be computed. */
  transitiveOptional: boolean | null;
  /** Transitions registered for this rule. */
  transitions: unknown[];

  /**
   * Creates an empty rule.
   *
   * @param name Name used by `!name` references.
   */
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

  /** Invalidates the cached optionality of the rule. */
  flushCache(): void {
    this.transitiveOptional = null;
  }

  /**
   * Appends an alternative pattern to the rule.
   *
   * @param pattern Pattern to append.
   */
  addPattern(pattern: Pattern,): void {
    this.patterns.push(pattern,);
  }

  /**
   * Whether some pattern of the rule starts with the given token.
   *
   * @param token Name of the first token to look for.
   * @returns `true` when a pattern starts with that token.
   */
  includes(token: string,): boolean {
    // Faithful port of Rule#include?: compares only the name of the 1st token.
    for (const p of this.patterns) {
      const first = p.length() > 0 ? p.get(0,) : null;
      if (first && first[1] === token) {
        return true;
      }
    }
    return false;
  }

  /** Marks the rule as optional (`[ ... ]`). */
  setOptional(): void {
    this.isOptional = true;
  }

  /**
   * Whether the whole rule can match nothing, directly or transitively.
   *
   * @param rules Every rule of the grammar, for the references.
   * @returns `true` when every pattern of the rule is optional.
   */
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

  /**
   * Creates the automaton states of the rule and of all its patterns.
   *
   * @param rules Every rule of the grammar.
   * @returns The states of the rule, entry state first.
   */
  generateStates(rules: Map<string, Rule>,): State[] {
    const states: State[] = [new State(this,),];
    for (const pattern of this.patterns) {
      states.push(...pattern.generateStates(this, rules,),);
    }
    return states;
  }

  /**
   * Adds the transitions that leave `sourceState` through this rule.
   *
   * @param states Every state of the automaton.
   * @param rules Every rule of the grammar.
   * @param keys Lookahead keys accepted by the source state.
   * @param stateStack Stack used to break the recursion between rules.
   * @param sourceState State that receives the transitions.
   * @param loopBack Whether the transition loops back to a previous state.
   */
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

  /** Marks the rule as repeatable (`...`). */
  setRepeatable(): void {
    this.repeatable = true;
  }

  /**
   * Documents the keyword defined by the last pattern.
   *
   * @param keyword Keyword described by the pattern.
   * @param doc Documentation text.
   * @throws Error When the rule has no pattern yet.
   */
  setDoc(keyword: string, doc: string,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setDoc(keyword, doc,);
  }

  /**
   * Documents one token of the last pattern.
   *
   * @param idx Index of the token.
   * @param doc Documentation of the token, or `null` to clear it.
   * @throws Error When the rule has no pattern yet.
   */
  setArg(idx: number, doc: TokenDoc | null,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setArg(idx, doc,);
  }

  /**
   * Sets the last syntax token of the last pattern.
   *
   * @param idx Index of the token.
   * @throws Error When the rule has no pattern yet.
   */
  setLastSyntaxToken(idx: number,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setLastSyntaxToken(idx,);
  }

  /**
   * Sets the support level of the last pattern.
   *
   * @param level One of the support-level strings.
   * @throws Error When the rule has no pattern yet.
   */
  setSupportLevel(level: string,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setSupportLevel(level,);
  }

  /**
   * Sets the "see also" keywords of the last pattern.
   *
   * @param also Keywords to list as related.
   * @throws Error When the rule has no pattern yet.
   */
  setSeeAlso(also: string[],): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setSeeAlso(also,);
  }

  /**
   * Sets the documentation example of the last pattern.
   *
   * @param file File that holds the example.
   * @param tag Tag of the example inside the file.
   * @throws Error When the rule has no pattern yet.
   */
  setExample(file: string, tag: string | null,): void {
    if (this.patterns.length === 0) {
      throw new Error("No pattern defined yet",);
    }
    this.patterns[this.patterns.length - 1]!.setExample(file, tag,);
  }

  /**
   * Pattern at an index.
   *
   * @param idx Index of the pattern.
   * @returns The pattern.
   * @throws Error When the index is out of range.
   */
  pattern(idx: number,): Pattern {
    const p = this.patterns[idx];
    if (!p) {
      throw new Error(`Pattern ${idx} not found in rule ${this.name}`,);
    }
    return p;
  }

  /**
   * Renders the syntax of the rule for the documentation.
   *
   * @param stack Rules already being rendered, to cut recursion.
   * @param docs Collector that receives the argument documentation.
   * @param rules Every rule of the grammar.
   * @param skip Number of leading tokens to skip.
   * @returns The syntax string of the whole rule.
   */
  to_syntax(
    stack: Map<unknown, boolean>,
    docs: Array<TokenDoc>,
    rules: Map<string, Rule>,
    skip: number = 0,
  ): string {
    // Cycle guard: recursive rules (e.g. logicalExpression) must not blow the
    // stack during serialization.
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
      stack.delete(this,);
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
