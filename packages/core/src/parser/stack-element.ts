import { type SourceFileInfo, } from "../source-file-info.ts";

/**
 * TextParserResultArray — Array especializado para múltiplos valores em um mesmo índice.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/StackElement.rb
 */
export class TextParserResultArray<T,> extends Array<T> {
  /**
   * Adiciona um valor, concatenando se o item já for um Array.
   * Se algum item é Array, concatena em vez de aninhar.
   */
  override push(...items: (T | T[])[]): number {
    for (const item of items) {
      if (Array.isArray(item,)) {
        // Concatena o array ao invés de aninhar
        super.push(...item,);
      } else {
        super.push(item,);
      }
    }
    return this.length;
  }
}

/**
 * StackElement — elemento da pilha do TextParser para rastrear estado.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/StackElement.rb
 */
export class StackElement {
  readonly val: unknown[];
  readonly sourceFileInfo: Array<SourceFileInfo | null>;
  firstSourceFileInfo: SourceFileInfo | null;
  private position: number;
  readonly function: ((...args: unknown[]) => unknown) | null;
  state: unknown | null;

  constructor(
    fn: ((...args: unknown[]) => unknown) | null,
    state: unknown | null = null,
  ) {
    this.val = [];
    this.sourceFileInfo = [];
    this.firstSourceFileInfo = null;
    this.position = 0;
    this.function = fn;
    this.state = state;
  }

  /**
   * Insere o valor _val_ na posição _index_.
   * Se _multiValue_ for true, concatena em vez de substituir (usa TextParserResultArray).
   */
  insert(
    index: number,
    val: unknown,
    sourceFileInfo: SourceFileInfo | null,
    multiValue: boolean,
  ): unknown {
    if (multiValue) {
      if (this.val[index]) {
        // Já temos um valor para esta posição.
        if (!Array.isArray(this.val[index],)) {
          // Isso não deveria acontecer.
          throw new Error(
            `${this.val[index].constructor.name} deve ser um Array`,
          );
        }
      } else {
        this.val[index] = new TextParserResultArray<unknown>();
      }
      // Apenas adiciona o valor e aplica a concatenação especial de Array.
      (this.val[index] as TextParserResultArray<unknown>).push(val,);
    } else {
      this.val[index] = val;
    }
    this.sourceFileInfo[index] = sourceFileInfo;
    // Armazena o primeiro SFI para acesso mais rápido.
    if (this.firstSourceFileInfo === null) {
      this.firstSourceFileInfo = sourceFileInfo;
    }
    return val;
  }

  /**
   * Armazena um valor coletado e avança a posição para o próximo padrão.
   */
  store(val: unknown, sourceFileInfo: SourceFileInfo | null = null,): void {
    this.val[this.position] = val;
    this.sourceFileInfo[this.position] = sourceFileInfo;
    this.position++;
  }

  /**
   * Itera sobre os valores armazenados.
   */
  each(): IterableIterator<unknown> {
    return this.val[Symbol.iterator]();
  }

  /**
   * Retorna o número de valores armazenados.
   */
  length(): number {
    return this.val.length;
  }
}
