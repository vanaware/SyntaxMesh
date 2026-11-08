/**
 * `canonical-dom.ts` — canonicalização de HTML para o golden da CLI (24.7.7).
 *
 * O HTML dos relatórios **não** é comparável byte a byte entre as duas
 * implementações, e nem deve ser: o `tj3` e o port desenham a mesma tabela com
 * indentação, quebras de linha e ordem de atributos diferentes sempre que um
 * `XMLElement` é reaberto. O que importa é a **árvore** — elementos, atributos
 * e texto.
 *
 * A canonicalização faz, nesta ordem:
 *
 * 1. **Estabiliza** o que muda por construção entre duas execuções do mesmo
 *    binário: ids de tooltip (`ID29120` × `ID1`) e o carimbo de criação do
 *    rodapé. O `scripts/golden/cli-tj3.rb` já aplica a mesma estabilização do
 *    lado do oráculo, então aqui ela é **idempotente** — `ID<n>` não casa com
 *    `ID\d+` e `<TS>` não casa com `Created on`.
 * 2. Extrai o conteúdo de `<body>`: `<head>` (title, metas), `<link>` de
 *    stylesheet e `<script>`/`<style>` inline são o envelope da página, não o
 *    relatório. O `<head>` do `tj3` traz `description`/`keywords` que o port
 *    não emite, e o `<link>` só carrega o nome do css.
 * 3. Descarta comentários (`<!-- Dynamic Report ID: 0 -->`) — são marcadores
 *    de depuração do gerador, com formatação que varia.
 * 4. Emite **um token por linha**: `<tag a="1" b="2">`, `</tag>` e os nós de
 *    texto com espaço colapsado. Atributos saem ordenados por nome e texto é
 *    `trim`ado, de modo que só diferenças de conteúdo sobrevivem.
 *
 * O resultado é uma lista de linhas comparável com `assertEquals`; a primeira
 * linha divergente já mostra onde a árvore quebrou.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7.7)
 * @see packages/cli/tests/golden/known_divergences.md
 */

/** Ids de tooltip: o `tj3` usa um contador global, o port reinicia em 1. */
const TOOLTIP_ID = /ID\d+/g;

/** Carimbo de criação do rodapé (`Created on 2026-11-08 12:01:34 ...`). */
const CREATED_ON = /Created on [^<]*/g;

/** Elementos cujo conteúdo não é árvore do relatório. */
const OPAQUE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** Comentário HTML (o `tj3` usa para marcar o id do relatório dinâmico). */
const COMMENT = /<!--[\s\S]*?-->/g;

/** `<link>` é vazio e só aponta para o css do produto. */
const LINK = /<link\b[^>]*>/gi;

/** `<body ...>` — o resto do documento é envelope. */
const BODY = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i;

/** Um token de marcação ou um trecho de texto entre marcas. */
const MARKUP =
  /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;

/** Um atributo dentro da lista de atributos de uma marca de abertura. */
const ATTRIBUTE =
  /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/**
 * Estabiliza o que muda por construção: id de tooltip e carimbo de criação.
 *
 * Mesma transformação de `scripts/golden/cli-tj3.rb#stabilize_html`, aplicada
 * no golden **e** na saída do port; aplicar duas vezes não muda nada.
 */
export function stabilizeHtml(html: string,): string {
  return html.replaceAll(TOOLTIP_ID, "ID<n>",).replaceAll(CREATED_ON, "<TS>",);
}

/** Conteúdo de `<body>` sem os elementos opacos. */
function bodyOf(html: string,): string {
  const body = BODY.exec(html,);
  if (body === null || body[1] === undefined) {
    throw new TypeError("canonicalDom: documento sem <body>",);
  }
  return body[1].replace(OPAQUE, "",).replace(LINK, "",).replace(COMMENT, "",);
}

/** Lista de atributos ordenada por nome, no formato ` nome="valor"`. */
function attributesOf(source: string,): string {
  const pairs: Array<[string, string,]> = [];
  for (const match of source.matchAll(ATTRIBUTE,)) {
    const name = match[1];
    if (name === undefined) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    pairs.push([name.toLowerCase(), value,],);
  }
  pairs.sort((a, b,) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return pairs.map(([name, value,],) => ` ${name}="${value}"`).join("",);
}

/** Texto com todo espaço colapsado e as pontas aparadas. */
function textOf(source: string,): string {
  return source.replace(/\s+/g, " ",).trim();
}

/**
 * Árvore canônica do HTML, uma linha por token.
 *
 * @throws {TypeError} quando o documento não tem `<body>` — sinal de que o
 *   relatório não foi gerado e o teste está comparando a coisa errada.
 */
export function canonicalDom(html: string,): string[] {
  // A estabilização entra aqui, e não no chamador: assim o golden (que já vem
  // estabilizado do Ruby) e a saída do port passam pelo mesmo caminho.
  const body = bodyOf(stabilizeHtml(html,),);
  const lines: string[] = [];
  let offset = 0;

  const pushText = (text: string,): void => {
    const collapsed = textOf(text,);
    if (collapsed !== "") lines.push(collapsed,);
  };

  MARKUP.lastIndex = 0;
  for (
    let match = MARKUP.exec(body,);
    match !== null;
    match = MARKUP.exec(body,)
  ) {
    pushText(body.slice(offset, match.index,),);
    offset = match.index + match[0].length;
    const tag = (match[2] ?? "").toLowerCase();
    if (tag === "") continue;
    if (match[1] === "/") {
      lines.push(`</${tag}>`,);
      continue;
    }
    // `<br />` e `<br>` são o mesmo nó; o `/` final só existe porque o
    // serializer do port fecha cada elemento explicitamente.
    lines.push(`<${tag}${attributesOf(match[3] ?? "",)}>`,);
  }
  pushText(body.slice(offset,),);

  return lines;
}

/**
 * Primeiras linhas em que duas árvores canônicas divergem.
 *
 * Existe para a mensagem de falha do golden apontar a linha exata em vez de
 * despejar as duas listas inteiras (relatório de 40+ nós).
 */
export function firstDifference(
  expected: readonly string[],
  actual: readonly string[],
): string {
  const length = Math.max(expected.length, actual.length,);
  for (let i = 0; i < length; i++) {
    if (expected[i] === actual[i]) continue;
    return `line ${i + 1}:\n  tj3:  ${expected[i] ?? "<missing>"}\n` +
      `  port: ${actual[i] ?? "<missing>"}`;
  }
  return "identical";
}
