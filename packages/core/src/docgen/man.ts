/**
 * `man.ts` — fachada do `man` do `doc-core` (22.1b.7 / 24.9.1–24.9.3).
 *
 * Reproduz o comportamento de `apps/Tj3Man.rb` sem tocar em disco, no
 * terminal ou no navegador: o resultado é **dado** — conteúdo textual e, no
 * formato HTML, o mapa de arquivos do manual. Quem imprime ou grava é a CLI.
 *
 * Três formatos:
 *
 * - `text` — documentação de terminal (`KeywordDocumentation#to_s`); sem
 *   keyword, a lista de todas as keywords documentadas (`Tj3Man.rb:110-120`).
 * - `html` — o manual completo (`UserManual#generate`) ou uma única página;
 *   o resultado vem em `files`, pronto para o `--output-dir` da CLI.
 * - `smx` — recorte de fonte colável: o exemplo anotado da keyword
 *   (`Pattern#exampleFile`) ou, sem exemplo, o esqueleto da sintaxe. Sem
 *   keyword, uma folha de referência com todas as keywords em comentários.
 *
 * A resolução de keywords usa o {@link TernarySearchTree} com casamento por
 * prefixo (`TernarySearchTree#find(prefix, true)`), como o `tj3man`; a
 * ambiguidade vira **aviso** com a lista de candidatos, não erro.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3Man.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G
 */

import { TernarySearchTree, } from "../utils/ternary-search-tree.ts";
import { SyntaxReference, syntaxReference, } from "./syntax-reference.ts";
import type { KeywordDocumentation, } from "./keyword-documentation.ts";
import { UserManual, } from "./user-manual.ts";
import { ExampleSnippet, } from "./example-snippet.ts";
import { EXAMPLE_CORPUS, } from "./manual/example-corpus.ts";
import {
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
} from "./manual/manual-css.ts";

/** Formatos de saída aceitos pela seção `man`. */
export type ManFormat = "text" | "html" | "smx";

/** Arquivo produzido no formato `html` (a CLI grava no `--output-dir`). */
export interface ManFile {
  /** Caminho relativo ao diretório de saída. */
  name: string;
  /** Conteúdo integral do arquivo. */
  contents: string;
}

/** Aviso produzido pela resolução de keywords. */
export interface ManMessage {
  /** `error` interrompe a saída daquela keyword; `warning` não. */
  level: "error" | "warning";
  /** Identificador estável (`man_no_matches`, …). */
  id: string;
  /** Texto em inglês, pronto para a CLI imprimir. */
  text: string;
}

/** Pedido da seção `man`. */
export interface ManRequest {
  /** Formato desejado (default `text`). */
  format?: ManFormat;
  /** Keywords pedidas; vazio = documento completo. */
  keywords?: readonly string[];
  /** Colore a saída textual com ANSI (`--no-color` desliga na CLI). */
  color?: boolean;
  /** Omite keywords `deprecated`/`removed`. */
  ignoreOld?: boolean;
}

/** Resultado da seção `man`. */
export interface ManOutput {
  /** Formato efetivamente usado. */
  format: ManFormat;
  /** Conteúdo textual (vazio no formato `html`, que usa `files`). */
  content: string;
  /** Arquivos do manual (só no formato `html`). */
  files: ManFile[];
  /** Avisos da resolução de keywords. */
  messages: ManMessage[];
}

/**
 * Gera a documentação pedida.
 *
 * Não lança para keyword desconhecida: a falha volta em `messages` para o
 * consumidor decidir o `exitCode` (a CLI usa `1`, como o `tj3man`).
 */
export function generateMan(request: ManRequest = {},): ManOutput {
  const format = request.format ?? "text";
  const keywords = [...(request.keywords ?? []),];
  const messages: ManMessage[] = [];

  switch (format) {
    case "html":
      return generateHtml(keywords, request, messages,);
    case "smx":
      return generateSmx(keywords, request, messages,);
    default:
      return generateText(keywords, request, messages,);
  }
}

// --- Formatos ---------------------------------------------------------------

/** Formato `text`: `to_s` de cada keyword, ou a lista completa. */
function generateText(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  const reference = syntaxReference(null, request.ignoreOld ?? false,);

  if (keywords.length === 0) {
    return {
      format: "text",
      content: `${reference.all().join("\n",)}\n`,
      files: [],
      messages,
    };
  }

  const parts: string[] = [];
  for (const resolved of resolveKeywords(reference, keywords, messages,)) {
    parts.push(reference.toText(resolved, request.color ?? false,),);
  }
  return {
    format: "text",
    content: parts.map((part,) => part.endsWith("\n",) ? part : `${part}\n`)
      .join("",),
    files: [],
    messages,
  };
}

/**
 * Formato `smx`: exemplo anotado ou esqueleto da sintaxe.
 *
 * O texto é pensado para colar num projeto — por isso usa o comentário do
 * próprio dialeto (`# …`) e não a marcação do manual.
 */
function generateSmx(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  const reference = syntaxReference(null, request.ignoreOld ?? false,);

  if (keywords.length === 0) {
    const blocks = ["# SyntaxMesh keyword cheat sheet",];
    for (const keyword of reference.all()) {
      const documentation = reference.keywords.get(keyword,);
      if (documentation === undefined) continue;
      blocks.push(smxBlock(documentation,),);
    }
    return {
      format: "smx",
      content: `${blocks.join("\n\n",)}\n`,
      files: [],
      messages,
    };
  }

  const blocks: string[] = [];
  for (const resolved of resolveKeywords(reference, keywords, messages,)) {
    const documentation = reference.keywords.get(resolved,);
    if (documentation === undefined) continue;
    blocks.push(smxBlock(documentation,),);
  }
  return {
    format: "smx",
    content: blocks.length === 0 ? "" : `${blocks.join("\n\n",)}\n`,
    files: [],
    messages,
  };
}

/** Formato `html`: manual completo, ou uma página. */
function generateHtml(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  if (keywords.length === 0) {
    const manual = new UserManual({ ignoreOld: request.ignoreOld ?? false, },);
    const pages = manual.generate();
    return {
      format: "html",
      content: "",
      files: Object.entries(pages,).map(([name, contents,],) => ({
        name,
        contents,
      })),
      messages,
    };
  }

  // Uma página só: não gera o manual inteiro, mas precisa da referência
  // ligada ao manual (cabeçalho, rodapé, navegação e exemplos).
  const manual = new UserManual({ ignoreOld: request.ignoreOld ?? false, },);
  manual.reference.all();

  const files: ManFile[] = [];
  for (
    const resolved of resolveKeywords(manual.reference, keywords, messages,)
  ) {
    files.push({
      name: `${resolved}.html`,
      contents: manual.reference.generateHTMLreference(resolved, manual,),
    },);
  }
  if (files.length > 0) {
    files.push({
      name: MANUAL_STYLESHEET_NAME,
      contents: MANUAL_STYLESHEET,
    },);
  }
  return { format: "html", content: "", files, messages, };
}

// --- Auxiliares -------------------------------------------------------------

/** Cabeçalho `# keyword: syntax`, exemplo anotado e propósito, nessa ordem. */
function smxBlock(documentation: KeywordDocumentation,): string {
  const header = `# ${documentation.title()}: ${documentation.syntax}`;
  const example = exampleFor(documentation,);
  if (example !== null) return `${header}\n${example.trimEnd()}`;
  const purpose = documentation.purposeText();
  return purpose === "" ? header : `${header}\n# ${purpose}`;
}

/**
 * Resolve cada keyword pedida, acumulando mensagens (fiel ao `Tj3Man`).
 *
 * Um prefixo que casa **uma única** keyword é resolvido para ela: o `tj3man`
 * repassa o texto digitado ao `to_s` e imprime nada, o que só frustra quem
 * digita `syntaxmesh man effor`. A ambiguidade continua sendo aviso, como no
 * Ruby.
 */
function resolveKeywords(
  reference: SyntaxReference,
  keywords: string[],
  messages: ManMessage[],
): string[] {
  const tree = new TernarySearchTree<string>();
  tree.insertList(reference.all(),);

  const resolved: string[] = [];
  for (const keyword of keywords) {
    const match = tree.find(keyword, true,);
    if (match === null) {
      messages.push({
        level: "error",
        id: "man_no_matches",
        text: `No matches found for '${keyword}'`,
      },);
      continue;
    }
    const candidates = Array.isArray(match,) ? match : [match,];
    if (candidates.length === 1) {
      resolved.push(candidates[0]!,);
      continue;
    }
    if (candidates.includes(keyword,)) {
      resolved.push(keyword,);
      continue;
    }
    messages.push({
      level: "warning",
      id: "man_multi_match",
      text: `Multiple matches found for '${keyword}':\n${
        candidates.join(", ",)
      }`,
    },);
  }
  return resolved;
}

/** Cache dos arquivos de exemplo já processados (um por corpus). */
const exampleCache = new Map<string, ExampleSnippet>();

/** Exemplo anotado da keyword (ou `null` quando ela não declara um). */
function exampleFor(documentation: KeywordDocumentation,): string | null {
  const file = documentation.pattern.exampleFile;
  if (!file) return null;
  let snippet = exampleCache.get(file,);
  if (snippet === undefined) {
    const source = EXAMPLE_CORPUS[file];
    if (source === undefined) return null;
    snippet = new ExampleSnippet();
    snippet.parse(source,);
    exampleCache.set(file, snippet,);
  }
  return snippet.text(documentation.pattern.exampleTag,);
}
