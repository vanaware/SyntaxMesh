import { type PropertyLike, } from "../model/property-like.ts";

/**
 * The diagnostic channel a `ScenarioData` reports through.
 *
 * A structural subset of `MessageHandler`, so the model can be exercised with a
 * simple recorder instead of the process-wide handler.
 */
export interface MessageHandlerLike {
  /**
   * Reports an error.
   *
   * @param id Stable message id, used for translation.
   * @param text Message text.
   * @param sfi Source location, when known.
   * @param property Property the message is about.
   */
  error(id: string, text: string, sfi?: string, property?: PropertyLike,): void;
  /**
   * Reports a warning.
   *
   * @param id Stable message id, used for translation.
   * @param text Message text.
   * @param sfi Source location, when known.
   * @param property Property the message is about.
   */
  warning(
    id: string,
    text: string,
    sfi?: string,
    property?: PropertyLike,
  ): void;
  /**
   * Reports an informational message.
   *
   * @param id Stable message id, used for translation.
   * @param text Message text.
   * @param sfi Source location, when known.
   * @param property Property the message is about.
   */
  info(id: string, text: string, sfi?: string, property?: PropertyLike,): void;
}
