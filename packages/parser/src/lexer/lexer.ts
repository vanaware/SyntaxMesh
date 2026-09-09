/// <reference lib="deno.ns" />

// ============================================================================
// 🔤 Lexer — Analisador léxico para SyntaxMesh
// ============================================================================

import { type Token, createToken, EOF, type TokenType } from "./token.ts";

export type { Token, TokenType };
export { createToken, EOF };

/**
 * Palavras-chave canônicas em inglês (idioma padrão)
 */
const KEYWORDS = new Set<string>([
  "language",
  "project",
  "task",
  "resource",
  "calendar",
  "scenario",
  "effort",
  "duration",
  "depends",
  "starts",
  "ends",
  "from",
  "to",
  "and",
  "or",
]);

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
  code: string; // código do idioma (ex: "en", "pt", "es")
  name: string; // nome legível (ex: "English", "Português", "Español")
  keywords: LanguageKeywords;
  timeUnits: Record<string, string>; // mapeamento de unidades (ex: {"h": "hours", "d": "days"})
}

/**
 * Definições de idiomas suportados
 */
export const LANGUAGE_DEFINITIONS: Record<string, LanguageDefinition> = {
  en: {
    code: "en",
    name: "English",
    keywords: {
      language: "language",
      project: "project",
      task: "task",
      resource: "resource",
      calendar: "calendar",
      scenario: "scenario",
      effort: "effort",
      duration: "duration",
      depends: "depends",
      starts: "starts",
      ends: "ends",
      from: "from",
      to: "to",
      and: "and",
      or: "or",
    },
    timeUnits: {
      h: "hours",
      d: "days",
      w: "weeks",
      m: "minutes",
    },
  },
  pt: {
    code: "pt",
    name: "Português",
    keywords: {
      language: "idioma",
      project: "projeto",
      task: "tarefa",
      resource: "recurso",
      calendar: "calendário",
      scenario: "cenário",
      effort: "esforço",
      duration: "duração",
      depends: "depende",
      starts: "inicia",
      ends: "termina",
      from: "de",
      to: "até",
      and: "e",
      or: "ou",
    },
    timeUnits: {
      h: "horas",
      d: "dias",
      w: "semanas",
      m: "minutos",
    },
  },
  es: {
    code: "es",
    name: "Español",
    keywords: {
      language: "idioma",
      project: "proyecto",
      task: "tarea",
      resource: "recurso",
      calendar: "calendario",
      scenario: "escenario",
      effort: "esfuerzo",
      duration: "duración",
      depends: "depende",
      starts: "comienza",
      ends: "termina",
      from: "de",
      to: "hasta",
      and: "y",
      or: "o",
    },
    timeUnits: {
      h: "horas",
      d: "días",
      w: "semanas",
      m: "minutos",
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

  constructor(input: string, language: LanguageDefinition = LANGUAGE_DEFINITIONS.en) {
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
          tokens.push(token);
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push(`Erro na linha ${this.state.line}, coluna ${this.state.column}: ${error.message}`);
          this.advance(); // Avança para tentar recuperar
        }
      }
    }

    tokens.push(EOF);

    return { tokens, errors, language: this.state.currentLanguage.code };
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
    this.advance();

    switch (ch) {
      case "(":
        return createToken("LPAREN", "(", this.state.position - 1, this.state.line, this.state.column - 1);
      case ")":
        return createToken("RPAREN", ")", this.state.position - 1, this.state.line, this.state.column - 1);
      case "{":
        return createToken("LBRACE", "{", this.state.position - 1, this.state.line, this.state.column - 1);
      case "}":
        return createToken("RBRACE", "}", this.state.position - 1, this.state.line, this.state.column - 1);
      case "[":
        return createToken("LBRACKET", "[", this.state.position - 1, this.state.line, this.state.column - 1);
      case "]":
        return createToken("RBRACKET", "]", this.state.position - 1, this.state.line, this.state.column - 1);
      case ":":
        return createToken("COLON", ":", this.state.position - 1, this.state.line, this.state.column - 1);
      case ";":
        return createToken("SEMICOLON", ";", this.state.position - 1, this.state.line, this.state.column - 1);
      case ",":
        return createToken("COMMA", ",", this.state.position - 1, this.state.line, this.state.column - 1);
      case "+":
        return createToken("PLUS", "+", this.state.position - 1, this.state.line, this.state.column - 1);
      case "-":
        return createToken("MINUS", "-", this.state.position - 1, this.state.line, this.state.column - 1);
      case "*":
        return createToken("MULTIPLY", "*", this.state.position - 1, this.state.line, this.state.column - 1);
      case "/":
        return createToken("DIVIDE", "/", this.state.position - 1, this.state.line, this.state.column - 1);
      case "=":
        return createToken("EQUALS", "=", this.state.position - 1, this.state.line, this.state.column - 1);
      case '"':
        return this.readString();
      case "'":
        return this.readString();
      default:
        if (this.isDigit(ch)) {
          return this.readNumber();
        }
        if (this.isAlpha(ch)) {
          return this.readIdentifier();
        }
        // Caracteres não reconhecidos são ignorados
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
    const start = this.state.position - 1;
    const startLine = this.state.line;
    const startColumn = this.state.column - 1;

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === "\n") {
        throw new Error("String não terminada");
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error("String não terminada");
    }

    this.advance(); // Fecha a string

    const value = this.state.input.slice(start + 1, this.state.position - 1);

    return createToken("STRING", value, start, startLine, startColumn);
  }

  /**
   * Lê um número
   */
  private readNumber(): Token {
    const start = this.state.position - 1;
    const startLine = this.state.line;
    const startColumn = this.state.column - 1;

    while (this.isDigit(this.peek()!)) {
      this.advance();
    }

    // Verifica se tem parte decimal
    if (this.peek() === "." && this.isDigit(this.peekNext()!)) {
      this.advance(); // consome o ponto
      while (this.isDigit(this.peek()!)) {
        this.advance();
      }
    }

    const value = this.state.input.slice(start, this.state.position);

    return createToken("NUMBER", value, start, startLine, startColumn);
  }

  /**
   * Lê um identificador ou palavra-chave
   */
  private readIdentifier(): Token {
    const start = this.state.position - 1;
    const startLine = this.state.line;
    const startColumn = this.state.column - 1;

    while (this.isAlphaNumeric(this.peek()!)) {
      this.advance();
    }

    const value = this.state.input.slice(start, this.state.position).toLowerCase();

    // Verifica se é uma palavra-chave no idioma atual
    const keywordMap = this.state.currentLanguage.keywords;
    for (const [type, keyword] of Object.entries(keywordMap)) {
      if (keyword.toLowerCase() === value) {
        return createToken(type.toUpperCase() as TokenType, value, start, startLine, startColumn);
      }
    }

    // Verifica se é uma unidade de tempo
    for (const [abbr, unit] of Object.entries(this.state.currentLanguage.timeUnits)) {
      if (abbr.toLowerCase() === value) {
        return createToken("TIME_UNIT", value, start, startLine, startColumn);
      }
    }

    return createToken("IDENTIFIER", value, start, startLine, startColumn);
  }

  /**
   * Verifica se é um dígito
   */
  private isDigit(ch: char): boolean {
    return ch >= "0" && ch <= "9";
  }

  /**
   * Verifica se é uma letra
   */
  private isAlpha(ch: char): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  /**
   * Verifica se é alfanumérico
   */
  private isAlphaNumeric(ch: char): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
}

type char = string;
