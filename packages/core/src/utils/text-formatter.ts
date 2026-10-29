/**
 * TextFormatter — formatação simples de blocos de texto puro (indentação e
 * largura de linha), usado pelo `RichTextElement.to_s` (Fase 12.3).
 *
 * Tarefa 16.6 da Fase 16 **antecipada** para a Fase 12: é dependência pura de
 * `Element.rb#to_s`, sem ligação com o resto da Fase 16.
 *
 * Port fiel de `TextFormatter.rb:21-184`:
 *   - `indent(str)` — insere `firstLineIndent`/`indentation` espaços no início
 *     de cada linha e descarta caracteres além de `width`; sempre termina com
 *     `\n`.
 *   - `format(str)` — FSM de quebra de linhas (estados `beginOfParagraph`,
 *     `inWord`, `betweenWords`, `betweenWordsOrLines`); `\r` força nova linha
 *     sem novo parágrafo; linha em branco termina o parágrafo.
 *   - iteração por **code point** (`each_utf8_char` → `[...str]`), como exige
 *     a nota UTF-8 da Fase 16.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextFormatter.rb
 */

export class TextFormatter {
  /** Largura máxima da linha, contando a indentação. */
  width: number;
  /** Indentação das linhas após a primeira. */
  indentation: number;
  /** Indentação da primeira linha (default: `indentation`). */
  firstLineIndent: number;

  constructor(width = 80, indentation = 0, firstLineIndent?: number,) {
    this.width = width;
    this.indentation = indentation;
    this.firstLineIndent = firstLineIndent ?? indentation;
  }

  /**
   * Indenta cada linha de `str` (`firstLineIndent` na primeira, `indentation`
   * nas demais) e corta o que exceder `width`. Sempre termina com `\n`.
   */
  indent(str: string,): string {
    let out = "";
    // Indentação pendente da linha atual; null quando já inserida.
    let indentBuf: string | null = " ".repeat(this.firstLineIndent,);
    let linePos = 0;
    for (const c of [...str,]) {
      if (c === "\n") {
        // Sem trailing whitespace: trocamos o buffer por uma quebra seca.
        if (indentBuf !== null) out += "\n";
        indentBuf = "\n" + " ".repeat(this.indentation,);
      } else {
        if (indentBuf !== null) {
          out += indentBuf;
          linePos = indentBuf.replace(/\n/g, "",).length;
          indentBuf = null;
        }
        // Descarta caracteres além da largura pedida.
        if (linePos < this.width) {
          out += c;
          linePos += 1;
        }
      }
    }
    // Sempre termina com quebra de linha.
    if (!out.endsWith("\n",)) out += "\n";
    return out;
  }

  /** Formata `str` (quebra de palavras na largura `width`). */
  format(str: string,): string {
    let out = "";
    // Coluna do último caractere da linha atual.
    let linePos = 0;
    // Buffer da palavra em processamento.
    let wordBuf = "";
    // Verdadeiro se estamos no início de uma linha.
    let beginOfLine = true;
    // Buffer de indentação da próxima linha.
    let indentBuf = " ".repeat(this.firstLineIndent,);
    type State =
      | "beginOfParagraph"
      | "inWord"
      | "betweenWords"
      | "betweenWordsOrLines";
    let state: State = "beginOfParagraph";

    const appendWord = (): void => {
      const wordLength = [...wordBuf,].length;
      if (wordLength === 0) return;

      // Se a palavra não cabe na linha, iniciamos nova linha.
      if (linePos + 1 + wordLength > this.width) beginOfLine = true;

      if (beginOfLine) {
        out += indentBuf;
        linePos = indentBuf.replace(/\n/g, "",).length;
        indentBuf = "\n" + " ".repeat(this.indentation,);
      } else {
        // Espaço separando palavras.
        out += " ";
        linePos += 1;
      }
      out += wordBuf;
      wordBuf = "";
      linePos += wordLength;
      if (beginOfLine) beginOfLine = false;
    };

    for (const c of [...str,]) {
      switch (state) {
        case "beginOfParagraph":
          if (c === " " || c === "\n") {
            // ignore
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        case "inWord":
          if (c === " " || c === "\n") {
            appendWord();
            state = c === " " ? "betweenWords" : "betweenWordsOrLines";
          } else if (c === "\r") {
            // CR quebra a linha sem fechar o parágrafo.
            appendWord();
            indentBuf = "\n" + " ".repeat(this.firstLineIndent,);
            beginOfLine = true;
            state = "betweenWords";
          } else {
            wordBuf += c;
          }
          break;
        case "betweenWords":
          if (c === " ") {
            // ignore
          } else if (c === "\n") {
            state = "betweenWordsOrLines";
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        case "betweenWordsOrLines":
          if (c === "\n") {
            // Quebra dupla = fim de parágrafo.
            indentBuf = "\n\n" + " ".repeat(this.firstLineIndent,);
            beginOfLine = true;
            state = "beginOfParagraph";
          } else if (c === " ") {
            state = "betweenWords";
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        default:
          throw new Error(`Unknown state in state machine: ${state}`,);
      }
    }
    appendWord();

    // Sempre termina com quebra de linha.
    if (!out.endsWith("\n",)) out += "\n";
    return out;
  }
}
