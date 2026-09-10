import { Parser, } from "../src/parser/parser.ts";
import { PORTUGUESE, } from "../src/language/definitions.ts";
import { Lexer, type Token, } from "../src/lexer/lexer.ts";

const input = `projeto "Meu Projeto" {
  tarefa "Tarefa 1" {
    duracao: 5 dias
  }
}`;

console.log("Input:", input,);
console.log("\n=== Testando Lexer ===",);

const lexer = new Lexer(input, PORTUGUESE,);
const result = lexer.tokenize();
console.log("Tokens:",);
result.tokens.forEach((t: Token,) => console.log(`  ${t.type}: "${t.value}"`,));
console.log("Errors:", result.errors,);

console.log("\n=== Testando Parser ===",);
const parser = new Parser(input, PORTUGUESE,);
const ast = parser.parse();
console.log("AST errors:", ast.errors,);
console.log("Task duration:", JSON.stringify(ast.ast?.tasks[0]?.duration, null, 2,),);
