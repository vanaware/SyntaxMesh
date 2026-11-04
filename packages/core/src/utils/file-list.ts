/**
 * `FileList` e `FileRecord` — registro dos arquivos lidos pelo parser.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/FileList.rb`. No Ruby o registro
 * serve para detectar se algum `.tjp` mudou desde a leitura (recarga do
 * projeto). No browser não há `File.mtime`, então `modified?` é sempre
 * `false` (Category B — ver `cheat-sheet-ruby-ts.md` §12): o arquivo chega
 * pelo `<input type=file>` e o conteúdo já foi consumido.
 *
 * @see docs/taskjuggler/lib/taskjuggler/FileList.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

/** Nome de um arquivo lido e o instante em que entrou na lista. */
export class FileRecord {
  readonly name: string;

  /** Instante de criação do registro (ms desde a epoch). */
  readonly mtime: number;

  constructor(fileName: string,) {
    this.name = fileName;
    this.mtime = Date.now();
  }

  /**
   * `true` se o arquivo mudou depois de registrado.
   *
   * Sempre `false` no browser: não há como consultar o mtime do arquivo
   * escolhido pelo usuário (Category B, fiel ao contrato que o chamador
   * espera — o Ruby retorna `File.mtime(@name) > @mtime`).
   */
  modified(): boolean {
    return false;
  }
}

/** Lista única de nomes de arquivo, com o registro de cada um. */
export class FileList {
  private readonly files = new Map<string, FileRecord>();

  /** Registros na ordem de inserção. */
  get records(): FileRecord[] {
    return [...this.files.values(),];
  }

  /** Quantidade de arquivos únicos. */
  get length(): number {
    return this.files.size;
  }

  /**
   * Registra `fileName` (Ruby `FileList#<<`): ignora `.` e duplicatas.
   */
  add(fileName: string,): void {
    if (fileName === "." || this.files.has(fileName,)) return;
    this.files.set(fileName, new FileRecord(fileName,),);
  }

  /** Mesma operação de {@link add} (sintaxe `<<` do Ruby). */
  push(fileName: string,): void {
    this.add(fileName,);
  }

  /** `true` quando o nome está registrado. */
  has(fileName: string,): boolean {
    return this.files.has(fileName,);
  }

  /** Registro do arquivo; `null` quando ausente. */
  get(fileName: string,): FileRecord | null {
    return this.files.get(fileName,) ?? null;
  }

  /**
   * Primeiro arquivo com extensão `.tjp` (Ruby `masterFile`).
   *
   * O Ruby compara `file[-4, 4] == '.tjp'`, então na prática é
   * "termina com `.tjp`" para nomes de 4+ caracteres; nomes mais curtos
   * devolvem `nil` por não alcançarem 4 caracteres.
   */
  get masterFile(): string | null {
    for (const file of this.files.keys()) {
      if (file.length >= 4 && file.slice(-4,) === ".tjp") return file;
    }
    return null;
  }

  /** `true` se algum arquivo mudou (sempre `false` no browser). */
  modified(): boolean {
    for (const record of this.files.values()) {
      if (record.modified()) return true;
    }
    return false;
  }

  /** Nomes na ordem de inserção (Ruby `each_key`). */
  [Symbol.iterator](): IterableIterator<string> {
    return this.files.keys();
  }
}
