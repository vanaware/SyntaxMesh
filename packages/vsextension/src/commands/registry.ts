/**
 * Duplicate-safe command registration shared by the Desktop and Web bootstrap.
 *
 * The registry is UI-free: activation supplies the real VS Code command object,
 * while tests can supply a recording registrar. It retains every returned
 * disposable so the shared bootstrap can transfer them to its extension context.
 */
import type { Disposable, } from "vscode";

/** One command callback accepted by the VS Code command registry. */
export type CommandHandler = (...args: never[]) => unknown;

/** Minimal command-registry boundary used by the shared bootstrap. */
export interface CommandRegistrar {
  registerCommand(id: string, handler: CommandHandler,): Disposable;
}

/** Tracks command ids and rejects accidental duplicate or incomplete wiring. */
export class CommandRegistry {
  private readonly registered = new Set<string>();
  private readonly registrations: Disposable[] = [];

  /** @param registrar host command registry, normally VS Code's `commands`. */
  constructor(private readonly registrar: CommandRegistrar,) {}

  /** Registered ids in insertion order. */
  get ids(): readonly string[] {
    return [...this.registered,];
  }

  /** Every host disposable returned by this registry, in registration order. */
  get disposables(): readonly Disposable[] {
    return [...this.registrations,];
  }

  /** Registers one command exactly once and returns its host disposable. */
  register(id: string, handler: CommandHandler,): Disposable {
    if (this.registered.has(id,)) {
      throw new Error(`duplicate command registration: ${id}`,);
    }
    this.registered.add(id,);
    const disposable = this.registrar.registerCommand(id, handler,);
    this.registrations.push(disposable,);
    return disposable;
  }

  /** Verifies that the registered ids equal the required public command set. */
  assertExact(expected: readonly string[],): void {
    const duplicates = expected.filter((id, index,) =>
      expected.indexOf(id,) !== index
    );
    if (duplicates.length > 0) {
      throw new Error(
        `duplicate expected command ids: ${
          [...new Set(duplicates,),].join(", ",)
        }`,
      );
    }
    const wanted = new Set(expected,);
    const missing = expected.filter((id,) => !this.registered.has(id,));
    const unexpected = [...this.registered,].filter((id,) => !wanted.has(id,));
    if (missing.length > 0) {
      throw new Error(`missing command registrations: ${missing.join(", ",)}`,);
    }
    if (unexpected.length > 0) {
      throw new Error(
        `unexpected command registrations: ${unexpected.join(", ",)}`,
      );
    }
  }
}
