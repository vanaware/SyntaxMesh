/**
 * UI-free YAML configuration hydration (22.12.5). The host supplies the file
 * reader; parsing and validation stay in this pure module.
 */
import { parse, } from "@std/yaml";
import type { CommandResult, } from "./contracts.ts";

/** Raw YAML plus the object consumed by the F24 execution request. */
export interface LoadedConfig {
  configContent: string;
  configObject: Record<string, unknown>;
}

/** Converts an arbitrary thrown value into the command failure contract. */
function failure(
  error: unknown,
): Extract<CommandResult<never>, { ok: false }> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages: [],
  };
}

/**
 * Reads and parses one YAML configuration, rejecting non-object roots.
 *
 * @param uri configuration file URI passed unchanged to the host reader.
 * @param readFile host-provided asynchronous file reader.
 * @returns the raw content and parsed object, or a structured failure.
 */
export async function loadConfig(
  uri: string,
  readFile: (path: string,) => Promise<string>,
): Promise<CommandResult<LoadedConfig>> {
  let configContent: string;
  try {
    configContent = await readFile(uri,);
  } catch (error) {
    return failure(error,);
  }

  let parsed: unknown;
  try {
    parsed = parse(configContent,);
  } catch (error) {
    return failure(`invalid YAML in ${uri}: ${failure(error,).error}`,);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed,)) {
    return failure(`configuration root must be an object: ${uri}`,);
  }

  return {
    ok: true,
    value: {
      configContent,
      configObject: parsed as Record<string, unknown>,
    },
    messages: [],
  };
}
