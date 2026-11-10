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
 * ParserToken — token handed by the scanner to the FSM.
 * `[type, name, sourceFileInfo]`, mirroring the Ruby `[type, name, sfi]`.
 * Element 1 is `unknown` because the Scanner converts values (DATE → TjTime,
 * INTEGER/FLOAT → number, TIME → seconds), as in Ruby.
 */
export type ParserToken = [string, unknown, SourceFileInfo | null,];

/**
 * Minimal host a Pattern action receives when it is called.
 * In Ruby the action runs through instance_eval on the TextParser and reads
 * @val/@sourceFileInfo; here it receives the parser itself, typed structurally
 * (which avoids a circular import).
 */
export interface ParserActionHost {
  /** Results of the pattern tokens collected so far. */
  readonly val: unknown[];
  /** Source location of each collected token. */
  readonly sourceFileInfo: Array<SourceFileInfo | null>;
}

/** Canonical order of the scanner token types (reference: Scanner.rb). */
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
 * Converts the name of a token type into a stable integer.
 * The result is always >= 0 for known types and -1 for unknown ones.
 *
 * @param type Name of the token type.
 * @returns The index of the type in the canonical list.
 */
export function tokenTypeToInt(type: string,): number {
  return SCANNER_TOKEN_TYPES.indexOf(type,);
}

/**
 * TextParser — finite-state automaton (FSM) with a grammar compiled at runtime.
 *
 * Line-by-line port of TextParser.rb. Abstract class: subclasses implement the
 * rule set (`rule_*` through `initRules`) and `nextToken`/`returnToken`.
 * Pattern actions are plain callbacks (no arrow) that receive the parser as
 * `this`/argument and read `parser.val` / `parser.sourceFileInfo`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser.rb
 * @see ADR 022 (FSM compiled at runtime)
 */
export abstract class TextParser {
  /** Rule set of the parser (Ruby @rules, Symbol → string). */
  readonly rules: Map<string, Rule> = new Map();
  /** Token types the scanner may return (Ruby @variables). */
  variables: string[] = [];
  /** Name of the current rule (Ruby @cr). */
  cr: Rule | null = null;
  /** FSM states: identity key → State (Ruby @states). */
  states: Map<string, State> = new Map();
  /** Stack of the FSM (Ruby @stack). */
  stack: StackElement[] | null = null;
  /** Results of the tokens of the pattern being processed (Ruby @val). */
  val: unknown[] = [];
  /** SourceFileInfo of the tokens of the pattern being processed (Ruby @sourceFileInfo). */
  sourceFileInfo: Array<SourceFileInfo | null> = [];
  /** Delegated scanner (TextScanner, phase 10.10). */
  protected scanner: unknown | null = null;
  /** Identity map for the state keys (replaces `states[[rule, pat, i]]`). */
  private _stateKeys: StateKeys = new Map();
  /** Tokens blocked by `limitTokenSet` (Ruby @blockedVariables). */
  private _blockedVariables: Map<string, boolean> = new Map();
  /** Explicit list of `rule_*` methods (reflection is not portable). */
  ruleMethods: string[] = [];

  /**
   * Restricts the tokens accepted by the scanner to the subset _tokenSet_.
   * Port of limitTokenSet (TextParser.rb l.98-110).
   *
   * @param tokenSet Tokens allowed in the next parse, or `null` for no limit.
   */
  limitTokenSet(tokenSet: string[] | null,): void {
    if (!tokenSet) {
      return;
    }
    // Copy of all supported tokens, minus the ones of the limited set.
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
   * Clears the set of blocked tokens (Ruby `@blockedVariables = {}` in
   * `RichTextParser#reuse`). Protected: only subclasses that reuse the singleton
   * need this explicit reset between parses.
   */
  protected clearBlockedVariables(): void {
    this._blockedVariables = new Map();
  }

  /**
   * Calls every `rule_*` method to initialise the rules.
   * Ruby uses reflection (`methods.grep(/^rule_/)`); in TS the list is explicit
   * through `ruleMethods` (cheat-sheet §12 Category B).
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
      // Creates the rule with the suffix of the function name as its name.
      this.newRule(m.slice(5,),);
      fn.call(this,);
    }
  }

  /**
   * Adds a new rule to the rule set and makes it the current rule.
   * Port of newRule (TextParser.rb l.124-142). Intentional difference: when the
   * rule already exists (registration through `initRules`), it is reused — Ruby
   * has no equivalent of `ruleMethods` and therefore raised in that case.
   *
   * @param name Name of the rule.
   * @param block Body that declares the patterns of the rule.
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
   * Adds a pattern to the most recently added rule.
   * Port of pattern (TextParser.rb l.144-157).
   *
   * @param tokens Tokens of the pattern, prefixed with `!`, `$`, `_` or `.`.
   * @param func Interpreter hook, when the pattern reduces to a value.
   */
  pattern(tokens: string[], func: (() => unknown) | null = null,): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.addPattern(new Pattern(tokens, func,),);
  }

  /** Marks the patterns of the current rule as optional. */
  optional(): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.setOptional();
  }

  /** Marks the patterns of the current rule as repeatable. */
  repeatable(): void {
    if (!this.cr) {
      throw new Error("No current rule. Call newRule() first.",);
    }
    this.cr.setRepeatable();
  }

  /**
   * Re-compiles the FSM after changes to the rule set (extend, new rules).
   * Port of updateParserTables (TextParser.rb l.171-192).
   */
  updateParserTables(): void {
    this.saveFsmStack();
    // Invalidates the cached data.
    for (const rule of this.rules.values()) {
      rule.flushCache();
    }
    this.states = new Map();
    // Generates the states of every pattern of every rule.
    for (const rule of this.rules.values()) {
      for (const s of rule.generateStates(this.rules,)) {
        this.states.set(
          stateKeyOf(s.rule, s.pattern, s.index, this._stateKeys,),
          s,
        );
      }
      this.checkRule(rule,);
    }
    // Computes the transitions between the generated states.
    for (const state of this.states.values()) {
      state.addTransitions(this.states, this.rules, this._stateKeys,);
    }
    this.restoreFsmStack();
  }

  /**
   * Parses the rule _ruleName_. Returns the result of the top action, or false
   * on error. Port of parse (TextParser.rb l.194-211).
   *
   * @param ruleName Name of the rule to parse.
   * @returns The parse result, or `false` when the parse failed.
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
   * SourceFileInfo of the start of the rule currently being processed.
   * Port of sourceFileInfo (TextParser.rb l.213-219).
   *
   * @returns Location of the start of the current rule, or `null`.
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
      // The real scanner exposes a method; test fakes may expose a property.
      return typeof scanner.sourceFileInfo === "function"
        ? scanner.sourceFileInfo()
        : scanner.sourceFileInfo;
    }
    return this.stack[this.stack.length - 1]!.firstSourceFileInfo;
  }

  /**
   * Records an error. With a scanner, delegates (it has more context); without
   * one, logs into the MessageHandler — Ruby recursed (real bug, l.221-230).
   *
   * @param id Message id used for deduplication.
   * @param text Error text.
   * @param sfi Location of the error, when known.
   * @param data Extra payload handed to the handler.
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
   * Records a warning. Same delegation as `error` (TextParser.rb l.232-241).
   *
   * @param id Message id used for deduplication.
   * @param text Warning text.
   * @param sfi Location of the warning, when known.
   * @param data Extra payload handed to the handler.
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

  /** Direct log into the MessageHandler (equivalent to Ruby's MessageHandler#error, which does not throw). */
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
   * Validates a rule: non-empty patterns, known tokens, valid references.
   * Port of checkRule (TextParser.rb l.245-265).
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
   * SHIFT/REDUCE loop of the FSM. Port of parseFSM (TextParser.rb l.267-356).
   * No arrow functions here — the actions run with `this` = parser.
   *
   * @param rule Rule whose starting state begins the parse.
   * @returns The value produced by the top-level action.
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
      // Ruby carried on with state=nil (MessageHandler#error did not throw); in
      // TS there is no way to continue without a state — we return false.
      return false;
    }
    this.stack = [new StackElement(null, state,),];

    let currentState: State = state;
    for (;;) {
      let transition: StateTransition | null = null;
      let token: ParserToken | null = null;
      if (currentState.transitions.size === 0) {
        // Final states of each pattern have no pre-compiled transitions. For
        // such a state we do not need to fetch a new token.
      } else {
        token = this.getNextToken();
        transition = currentState.transition(
          token as unknown as [string, string,],
        );
      }

      // On loop-back we need to finish the pattern first. Final tokens of
      // repeatable rules do have transitions!
      if (transition && transition.loopBack) {
        this.finishPattern(token,);
        token = this.getNextToken();
        transition = currentState.transition(
          token as unknown as [string, string,],
        );
      }

      if (transition) {
        // SHIFT: normal transition — next token of the same pattern or start of
        // a new pattern. The transition says which state to process next.
        currentState = transition.state;

        // Transitions that enter rules create states we must return to when the
        // rule finishes. We push that list onto @stack.
        const stackElement = this.stack[this.stack.length - 1]!;
        let first = true;
        for (const s of transition.stateStack) {
          this.checkForOldSyntax(s, token!,);
          // `stackElement.state` may be a [rule, pattern, index] tuple —
          // resolved as a State before comparing the pattern (faithful to Ruby,
          // which reads stackElement.state.pattern on every iteration).
          if (first && s.pattern === this.stateOf(stackElement,)?.pattern) {
            // The first state of the list may just be another state of the
            // current pattern — the StackElement is already on the stack.
            stackElement.state = s;
          } else {
            // We keep [rule, pattern, index] (Ruby equivalent) so that
            // save/restoreFsmStack operate on the same representation.
            this.stack.push(
              new StackElement(null, [s.rule, s.pattern, s.index,],),
            );
          }
          first = false;
        }

        if (currentState.index === 0) {
          // We start a new pattern (or loop-back): push a new StackEntry, which
          // holds the pattern result and the return state.
          this.checkForOldSyntax(currentState, token!,);
          this.stack.push(
            new StackElement(
              currentState.pattern ? currentState.pattern.function : null,
              [currentState.rule, currentState.pattern, currentState.index,],
            ),
          );
        }

        // Stores the token value in the results array.
        this.stack[this.stack.length - 1]?.insert(
          currentState.index,
          token ? token[1] : null,
          token ? token[2] : null,
          false,
        );
      } else {
        // REDUCE: we reached the end of a rule. There is no pre-compiled
        // transition; the current token, if any, is of no use here —
        // finishPattern hands it back to the scanner.
        if (currentState.noReduce) {
          // Only states that close a rule may trigger a reduce. States with
          // noReduce reached here indicate an unsupported token.
          const top = this.stack[this.stack.length - 1];
          const topState = top ? this.stateOf(top,) : null;
          const expected = topState ? topState.expectedTokens() : [];
          this.error(
            "no_reduce",
            `Unexpected token '${token ? token[1] : "<END>"}' found. ` +
              "Expecting " +
              `${expected.length > 1 ? "one of " : ""}` +
              `${expected.join(", ",)}`,
            token ? token[2] : null,
          );
        }
        if (this.finishPattern(token,)) {
          // ACCEPT: we finished the parse.
          break;
        }
        const next = this.stateOf(
          this.stack[this.stack.length - 1],
        );
        if (!next) {
          // Ruby would continue with state=nil and crash with a TypeError; in
          // TS we stop after the error has been recorded.
          break;
        }
        currentState = next;
      }
    }

    return this.stack && this.stack.length > 0 ? this.stack[0]!.val[0] : null;
  }

  /** Resolves the State of a StackElement (plain State or [rule, pattern, index] tuple). */
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
   * Finishes the pattern on top of the stack: pop, call the action, insert the
   * result at the lower level. Port of finishPattern (TextParser.rb l.358-410).
   *
   * @param token Token read for the next state, handed back to the scanner.
   * @returns `true` when the whole parse is accepted.
   */
  private finishPattern(token: ParserToken | null,): boolean {
    // The action of this pattern may include another file or change the rules;
    // we hand the token back to the scanner before anything else.
    if (token) {
      this.returnToken(token,);
    }

    // To finish a pattern, pop the StackElement that holds the token values.
    const stackEntry = this.stack!.pop();
    if (stackEntry === undefined || this.stack!.length === 0) {
      // We reached the bottom of the stack.
      const t = this.getNextToken();
      if (t[0] === "endOfText") {
        // End of the top-level file: we push the StackEntry back (it holds the
        // overall parse result) and signal ACCEPT.
        this.stack!.push(stackEntry!,);
        return true;
      }
      // Token that violates the syntax rules.
      const expected = stackEntry
        ? (this.stateOf(stackEntry,)?.expectedTokens() ?? []).join(", ",)
        : "";
      this.error(
        "unexpctd_token",
        `Unexpected token '${t[1]}' found. Expecting one of ${expected}`,
        t[2],
      );
    }

    // Remembers whether the rule of this pattern was repeatable; the result
    // becomes an Array.
    const state = stackEntry === undefined ? null : this.stateOf(stackEntry,) ??
      (stackEntry.state instanceof State ? stackEntry.state : null);
    if (!state) {
      // Ruby: stackEntry nil → NoMethodError. In TS: ends the pattern.
      return false;
    }
    const ruleIsRepeatable = state.rule.repeatable;
    let result: unknown = null;
    if (state.pattern && state.pattern.function) {
      // Makes the token values and their SourceFileInfo available to the
      // action. Ruby: `@val` is an Array where indices of unfilled optional
      // tokens read `nil`. In TS holes become `undefined` — the pattern indices
      // are normalized to null before the action.
      const vals = stackEntry!.val;
      for (let i = 0; i < state.pattern.tokens.length; i++) {
        if (vals[i] === undefined) vals[i] = null;
      }
      this.val = vals;
      this.sourceFileInfo = stackEntry!.sourceFileInfo;
      try {
        // The action runs as a plain callback (no arrow): `this` = parser.
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

    // We use the SourceFileInfo of the pattern's first token for the result.
    const firstSourceFileInfo = stackEntry!.firstSourceFileInfo;
    // Stores the result at the right position of the lower stack level.
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
   * Prints the FSM stack (debug). Port of dumpStack (TextParser.rb l.412-434).
   *
   * @returns The textual dump of every stack level.
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
   * Detects deprecated/removed syntax on the current token.
   * Port of checkForOldSyntax (TextParser.rb l.436-449).
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
   * Converts the State objects of the stack into [rule, pattern, index] so they
   * survive the re-compilation of the FSM. Port of saveFsmStack (l.451-460).
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
   * Converts the [rule, pattern, index] of the stack back into State objects.
   * Port of restoreFsmStack (l.462-472).
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
   * Fetches the next token from the scanner and applies the blocked set.
   * Port of getNextToken (TextParser.rb l.474-483).
   *
   * @returns The next token, already validated against `limitTokenSet`.
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

  /** Hands the token back to the scanner (push-back). Abstract. */
  protected abstract returnToken(token: ParserToken | null,): void;

  /** Next token of the scanner. Abstract. */
  protected abstract nextToken(): ParserToken;
}
