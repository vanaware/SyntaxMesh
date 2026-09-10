/// <reference lib="deno.ns" />

// ============================================================================
// 🔤 Lexer — Analisador léxico para SyntaxMesh
// ============================================================================

import { ENGLISH, PORTUGUESE, } from "../language/definitions.ts";
import { createToken, EOF, type Token, type TokenType, } from "./token.ts";

export type { Token, TokenType, };
export { createToken, EOF, };

/**
 * Mapeamento de palavras-chave por idioma
 */
export interface LanguageKeywords {
  language: string;
  project: string;
  task: string;
  resource: string;
  calendar: string;
  scenario: string;
  effort: string;
  duration: string;
  depends: string;
  starts: string;
  ends: string;
  from: string;
  "to": string;
  and: string;
  or: string;
}

/**
 * Definição completa de um idioma
 */
export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}

/**
 * Definições de idiomas suportados
 */
export const LANGUAGE_DEFINITIONS: Record<string, LanguageDefinition> = {
  "en": ENGLISH,
  "pt": PORTUGUESE,
  "es": {
    id: "es",
    name: "Español",
    keywords: {
      project: ["proyecto",],
      task: ["tarea",],
      resource: ["recurso",],
      depends: ["depende",],
      effort: ["esfuerzo",],
      duration: ["duración",],
      scenario: ["escenario",],
    },
    units: {
      hour: ["h", "hora", "horas",],
      day: ["d", "día", "días",],
      week: ["sem", "semana", "semanas",],
      month: ["m", "mes", "meses",],
      year: ["y", "año", "años",],
      minute: ["min", "minuto", "minutos",],
    },
  },
};

/**
 * Estado interno do lexer
 */
interface LexerState {
  input: string;
  position: number;
  line: number;
  column: number;
  currentLanguage: LanguageDefinition;
}

/**
 * Resultado do lexing
 */
export interface LexResult {
  tokens: Token[];
  errors: string[];
  language: string; // idioma detectado ou padrão
}

/**
 * Lexer para SyntaxMesh
 */
export class Lexer {
  private state: LexerState;

  constructor(input: string, language: LanguageDefinition = ENGLISH,) {
    this.state = {
      input,
      position: 0,
      line: 1,
      column: 1,
      currentLanguage: language,
    };
  }

  /**
   * Executa o lexing completo sobre a entrada
   */
  tokenize(): LexResult {
    const tokens: Token[] = [];
    const errors: string[] = [];

    while (!this.isAtEnd()) {
      try {
        const token = this.scanToken();
        if (token) {
          tokens.push(token,);
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push(
            `Erro na linha ${this.state.line}, coluna ${this.state.column}: ${error.message}`,
          );
          this.advance(); // Avança para tentar recuperar
        }
      }
    }

    tokens.push(EOF,);

    return { tokens, errors, language: this.state.currentLanguage.id, };
  }

  /**
   * Verifica se chegou ao fim da entrada
   */
  private isAtEnd(): boolean {
    return this.state.position >= this.state.input.length;
  }

  /**
   * Avança para o próximo caractere
   */
  private advance(): char | undefined {
    if (this.isAtEnd()) {
      return undefined;
    }
    const ch = this.state.input[this.state.position];
    this.state.position++;
    if (ch === "\n") {
      this.state.line++;
      this.state.column = 1;
    } else {
      this.state.column++;
    }
    return ch;
  }

  /**
   * Olha o caractere atual sem avançar
   */
  private peek(): string | undefined {
    return this.state.input[this.state.position];
  }

  /**
   * Olha o próximo caractere sem avançar
   */
  private peekNext(): char | undefined {
    if (this.state.position + 1 >= this.state.input.length) {
      return undefined;
    }
    return this.state.input[this.state.position + 1];
  }

  /**
   * Escaneia um token e retorna-o
   */
  private scanToken(): Token | null {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return null;
    }

    const ch = this.peek()!;

    switch (ch) {
      case "(":
        this.advance();
        return createToken(
          "LPAREN",
          "(",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case ")":
        this.advance();
        return createToken(
          "RPAREN",
          ")",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "{":
        this.advance();
        return createToken(
          "LBRACE",
          "{",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "}":
        this.advance();
        return createToken(
          "RBRACE",
          "}",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "[":
        this.advance();
        return createToken(
          "LBRACKET",
          "[",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "]":
        this.advance();
        return createToken(
          "RBRACKET",
          "]",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case ":":
        this.advance();
        return createToken(
          "COLON",
          ":",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case ";":
        this.advance();
        return createToken(
          "SEMICOLON",
          ";",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case ",":
        this.advance();
        return createToken(
          "COMMA",
          ",",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "+":
        this.advance();
        return createToken(
          "PLUS",
          "+",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "-":
        this.advance();
        return createToken(
          "MINUS",
          "-",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "*":
        this.advance();
        return createToken(
          "MULTIPLY",
          "*",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "/":
        this.advance();
        return createToken(
          "DIVIDE",
          "/",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case "=":
        this.advance();
        return createToken(
          "EQUALS",
          "=",
          this.state.position - 1,
          this.state.line,
          this.state.column - 1,
        );
      case '"':
        return this.readString();
      case "'":
        return this.readString();
      default:
        if (this.isDigit(ch,)) {
          return this.readNumber();
        }
        if (this.isAlpha(ch,)) {
          return this.readIdentifier();
        }

        // Caracteres não reconhecidos são ignorados
        this.advance();
        return null;
    }
  }

  /**
   * Pula espaços em branco e comentários
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
      } else if (ch === "\n") {
        this.advance();
      } else if (ch === "#") {
        this.skipComment();
      } else {
        break;
      }
    }
  }

  /**
   * Pula um comentário até o final da linha
   */
  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  /**
   * Lê uma string entre aspas
   */
  private readString(): Token {
    const quote = this.peek()!;
    const start = this.state.position;
    const startLine = this.state.line;
    const startColumn = this.state.column;

    // Avança para passar a aspa de abertura
    this.advance();

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === "\n") {
        throw new Error("String não terminada",);
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error("String não terminada",);
    }

    // Salva posição de fechamento antes de avançar
    const endPos = this.state.position;
    this.advance(); // Fecha a string

    const value = this.state.input.slice(start + 1, endPos,);

    return createToken("STRING", value, start, startLine, startColumn,);
  }

  /**
   * Lê um número
   */
  private readNumber(): Token {
    const start = this.state.position;
    const startLine = this.state.line;
    const startColumn = this.state.column;

    while (this.isDigit(this.peek()!,)) {
      this.advance();
    }

    // Verifica se tem parte decimal
    if (this.peek() === "." && this.isDigit(this.peekNext()!,)) {
      this.advance(); // consome o ponto
      while (this.isDigit(this.peek()!,)) {
        this.advance();
      }
    }

    const value = this.state.input.slice(start, this.state.position,);

    return createToken("NUMBER", value, start, startLine, startColumn,);
  }

  /**
   * Lê um identificador ou palavra-chave
   */
  private readIdentifier(): Token {
    const start = this.state.position;
    const startLine = this.state.line;
    const startColumn = this.state.column;

    while (this.isAlphaNumeric(this.peek()!,)) {
      this.advance();
    }

    const value = this.state.input.slice(start, this.state.position,).toLowerCase();

    // Verifica se é uma palavra-chave no idioma atual
    for (const [type, keywords,] of Object.entries(this.state.currentLanguage.keywords,)) {
      if (Array.isArray(keywords,)) {
        if (keywords.some((k,) => k.toLowerCase() === value)) {
          return createToken(
            type.toUpperCase() as TokenType,
            value,
            start,
            startLine,
            startColumn,
          );
        }
      } else if (typeof keywords === "string") {
        if ((keywords as string).toLowerCase() === value) {
          return createToken(
            type.toUpperCase() as TokenType,
            value,
            start,
            startLine,
            startColumn,
          );
        }
      }
    }

    // Verifica se é uma unidade de tempo
    for (const [unitType, unitValues,] of Object.entries(this.state.currentLanguage.units,)) {
      if (Array.isArray(unitValues,) && unitValues.some((u,) => u.toLowerCase() === value)) {
        return createToken("TIME_UNIT", value, start, startLine, startColumn,);
      }
    }

    return createToken("IDENTIFIER", value, start, startLine, startColumn,);
  }

  /**
   * Verifica se é um dígito
   */
  private isDigit(ch: char,): boolean {
    return ch >= "0" && ch <= "9";
  }

  /**
   * Verifica se é uma letra (suporta caracteres Unicode/acentuados)
   */
  private isAlpha(ch: char,): boolean {
    return (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      ch === "_" ||
      ch === "á" || ch === "à" || ch === "â" || ch === "ã" || ch === "ä" || ch === "å" ||
      ch === "é" || ch === "è" || ch === "ê" || ch === "ë" ||
      ch === "í" || ch === "ì" || ch === "î" || ch === "ï" ||
      ch === "ó" || ch === "ò" || ch === "ô" || ch === "õ" || ch === "ö" ||
      ch === "ú" || ch === "ù" || ch === "û" || ch === "ü" ||
      ch === "ñ" || ch === "ç" ||
      ch === "Á" || ch === "À" || ch === "Â" || ch === "Ã" || ch === "Ä" || ch === "Å" ||
      ch === "É" || ch === "È" || ch === "Ê" || ch === "Ë" ||
      ch === "Í" || ch === "Ì" || ch === "Î" || ch === "Ï" ||
      ch === "Ó" || ch === "Ò" || ch === "Ô" || ch === "Õ" || ch === "Ö" ||
      ch === "Ú" || ch === "Ù" || ch === "Û" || ch === "Ü" ||
      ch === "Ñ" || ch === "Ç";
  }

  /**
   * Verifica se é alfanumérico
   */
  private isAlphaNumeric(ch: char,): boolean {
    return this.isAlpha(ch,) || this.isDigit(ch,);
  }
}

type char = string;
