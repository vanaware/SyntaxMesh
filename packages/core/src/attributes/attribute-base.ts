/**
 * Classe base abstrata para todos os atributos do TaskJuggler.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (arquivo inteiro)
 */

import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "./attribute-container.ts";
import { type AttributeDefinition, } from "./attribute-definition.ts";
import { deepClone, } from "../utils/deep-clone.ts";
import { AttributeOverwrite, NotYetImplementedError, } from "./errors.ts";

/**
 * Modos globais para o comportamento de `set()` e `inherit()`.
 *
 * @see 014-attribute-mode-global.md
 */
export type AttributeMode = 0 | 1 | 2;

/**
 * Classe base abstrata para todos os atributos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb
 */
export abstract class AttributeBase<T,> {
  /**
   * Modo global que influencia `set()` e `inherit()`.
   *
   * @see 014-attribute-mode-global.md
   */
  private static _mode: AttributeMode = 0;

  static get mode(): AttributeMode {
    return AttributeBase._mode;
  }

  static setMode(mode: AttributeMode,): void {
    if (mode !== 0 && mode !== 1 && mode !== 2) {
      throw new Error(`Modo inválido: ${mode}. Deve ser 0, 1 ou 2.`,);
    }
    AttributeBase._mode = mode;
  }

  /**
   * Propriedade que contém este atributo.
   */
  protected readonly property: PropertyLike;

  /**
   * Definição do tipo deste atributo (contém id, name, default, etc.).
   */
  protected readonly type: AttributeDefinition<T>;

  /**
   * Container que armazena o valor deste atributo.
   */
  protected readonly container: AttributeContainer;

  /**
   * Se `true`, o valor foi fornecido explicitamente (usuário).
   */
  public provided: boolean = false;

  /**
   * Se `true`, o valor foi herdado (pai/projeto).
   */
  public inherited: boolean = false;

  constructor(
    property: PropertyLike,
    type: AttributeDefinition<T>,
    container: AttributeContainer,
  ) {
    this.property = property;
    this.type = type;
    this.container = container;
  }

  /**
   * Reseta o atributo ao seu estado padrão.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:reset
   */
  reset(): void {
    this.inherited = false;
    this.provided = false;
    this.container.setStoredValue(
      this.type.id,
      deepClone(this.type.defaultValue,),
    );
  }

  /**
   * Herda um valor do pai ou projeto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:inherit
   */
  inherit(value: T,): void {
    this.inherited = true;
    this.container.setStoredValue(this.type.id, deepClone(value,),);
  }

  /**
   * Define um valor para o atributo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:set
   */
  set(value: T,): void {
    switch (AttributeBase.mode) {
      case 0: // provided
        this.provided = true;
        break;
      case 1: // inherited
        this.inherited = true;
        break;
      case 2: // computed
        // nenhuma flag é marcada
        break;
    }
    this.container.setStoredValue(this.type.id, value,);
  }

  /**
   * Obtém o valor atual do atributo.
   */
  get(): T | null {
    return this.container.getStoredValue(this.type.id,) as T | null;
  }

  /**
   * Obtém o valor como `unknown` (para serialização).
   */
  get value(): unknown {
    return this.container.getStoredValue(this.type.id,);
  }

  /**
   * ID do tipo de atributo para serialização TJP.
   *
   * Subclasses definem `static readonly tjpId`. Este getter permite
   * acessá-lo via instância sem repetir o nome da classe.
   */
  protected get tjpId(): string {
    return (this.constructor as unknown as { tjpId: string }).tjpId;
  }

  /**
   * Obtém o ID do atributo.
   */
  get id(): string {
    return this.type.id;
  }

  /**
   * Obtém o nome do atributo.
   */
  get name(): string {
    return this.type.name;
  }

  /**
   * Verifica se o atributo é nil (null, undefined ou array vazio).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:nil?
   */
  isNil(): boolean {
    const val = this.container.getStoredValue(this.type.id,);
    return val === null || val === undefined ||
      (Array.isArray(val,) && val.length === 0);
  }

  /**
   * Verifica se o atributo é uma lista.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:isList?
   */
  isList(): boolean {
    return false;
  }

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_s
   */
  to_s(): string {
    const val = this.get();
    return val === null ? "" : String(val,);
  }

  /**
   * Converte o valor para número.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_num
   */
  to_num(): number {
    const val = this.get();
    if (val === null) {
      return 0;
    }
    return Number(val,);
  }

  /**
   * Converte o valor para string de ordenação.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_sort
   */
  to_sort(): string {
    const val = this.get();
    if (val === null) {
      return "";
    }
    return String(val,);
  }

  /**
   * Converte o valor para RTI (Rich Text Intermediate).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_rti
   */
  to_rti(): unknown {
    throw new NotYetImplementedError("12", "to_rti",);
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  to_tjp(): unknown {
    throw new NotYetImplementedError("11", "to_tjp",);
  }

  /**
   * Retorna uma representação string escapada.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:quotedString
   */
  quotedString(str?: string,): string {
    const s = str ?? this.to_s();
    if (s.includes("\n",)) {
      return `-8<-\n${s}\n->8-`;
    }
    return `"${s.replace(/"/g, '\\"',)}"`;
  }
}
