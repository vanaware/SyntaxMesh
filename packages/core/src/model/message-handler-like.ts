import { type PropertyLike, } from "../model/property-like.ts";

export interface MessageHandlerLike {
  error(id: string, text: string, sfi?: string, property?: PropertyLike): void;
  warning(id: string, text: string, sfi?: string, property?: PropertyLike): void;
  info(id: string, text: string, sfi?: string, property?: PropertyLike): void;
}