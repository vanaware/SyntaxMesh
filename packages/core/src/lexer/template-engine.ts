/**
 * template-engine — wrapper fino da engine Vento para o elemento `template`
 * (Fase 23, extensão TS-only; ADR 033).
 *
 * **Único módulo do core que importa `ventojs`.** Nenhum outro arquivo pode
 * importar a lib: quem precisa renderizar usa `renderTemplate`.
 *
 * Por que não `env.runString()`: a FSM do `TextParser` é síncrona (o scanner
 * expande `${...}` dentro de `nextToken()`), enquanto o Vento 2.x compila
 * **todo** template para uma função `async`. A saída usada aqui é compilar com
 * `env.compile()` — que valida a sintaxe e devolve o código-fonte gerado em
 * `template.code` — e executar esse mesmo código com o cabeçalho
 * `async function __template` reescrito para `function __template`.
 *
 * A reescrita é segura porque o subconjunto de tags usadas para gerar `.tjp`
 * (`{{ }}`, `if`, `for`, `set`, `echo`, pipes) não emite nenhum `await`; um
 * corpo que exija I/O (`include`, `layout`, `for await`) não passa na
 * compilação síncrona e é reportado como `async_tag`. Para o subconjunto
 * síncrono o resultados é **byte-idêntico** ao de `env.runString()` (coberto
 * por teste em `tests/lexer/template-engine_test.ts`).
 *
 * Autoescape permanece **desligado** (garantia do plano §4.8): a saída é
 * TaskJuggler, não HTML. O filtro `escape` explícito continua disponível.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md (§4.3, §4.7, §4.8)
 * @see docs/syntaxmesh/decisoes/033-elemento-template.md
 */
import vento from "vento";

/**
 * Tipo do `Environment` do Vento. A lib não reexporta a classe em `mod.js`
 * (só o default `vento(options)`), então derivamos do próprio factory.
 */
type VentoEnvironment = ReturnType<typeof vento>;

/** Dados injetados no contexto do template (params + chaves globais). */
export type TemplateData = Record<string, unknown>;

/** Como a renderização falhou. */
export type TemplateFailureKind = "syntax" | "runtime" | "async";

/** Renderização bem-sucedida. */
export interface TemplateRenderSuccess {
  ok: true;
  content: string;
}

/**
 * Renderização com erro. `position` é o deslocamento em caracteres dentro do
 * **corpo do template**; `line`/`column` são 1-based relativos ao corpo — o
 * chamador mapeia para a linha original do `.tjp`.
 */
export interface TemplateRenderFailure {
  ok: false;
  kind: TemplateFailureKind;
  message: string;
  position: number;
  line: number;
  column: number;
}

export type TemplateRenderResult =
  | TemplateRenderSuccess
  | TemplateRenderFailure;

/** Template já compilado: recebe os dados e devolve `{ content }`. */
export type CompiledTemplate = (data: TemplateData,) => { content: string };

/** Cabeçalhos gerados pelo `Environment#compile` do Vento 2.x. */
const ASYNC_HEADER = "async function __template";
const SYNC_HEADER = "function __template";

/** Limite de corpos compilados em cache (LRU aproximado por inserção). */
const CACHE_LIMIT = 256;

/** Converte `position` (offset) em linha/coluna 1-based do corpo. */
export function lineColumnOf(
  source: string,
  position: number,
): [number, number,] {
  let line = 1;
  let column = 1;
  const end = Math.max(0, Math.min(position, source.length,),);
  for (let i = 0; i < end; i++) {
    if (source.charCodeAt(i,) === 10) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return [line, column,];
}

/**
 * Compila o código gerado pelo Vento (`AsyncFunction` → `Function`).
 * Lança `SyntaxError` quando o corpo depende de `await` (tag assíncrona).
 */
function makeSyncTemplate(
  code: string,
  env: VentoEnvironment,
): CompiledTemplate {
  const syncSource = code.replace(ASYNC_HEADER, SYNC_HEADER,);
  // `code` é `function anonymous(__env) { return <template>; }` — o wrapper
  // externo recebe o Environment e devolve o template interno.
  const makeOuter = new Function(`return (${syncSource});`,);
  const outer = makeOuter() as (env: VentoEnvironment,) => CompiledTemplate;
  return outer(env,);
}

/** Engine Vento compartilhada pelo core (autoescape desligado). */
export class TemplateEngine {
  private readonly env: VentoEnvironment;
  private readonly cache = new Map<string, CompiledTemplate>();

  constructor() {
    this.env = vento({ autoescape: false, },);
  }

  /**
   * Compila (com cache) um corpo de template.
   *
   * Devolve `{ ok: true, template }` ou a falha de sintaxe/async já com a
   * posição no corpo.
   */
  compile(
    body: string,
  ):
    | { ok: true; template: CompiledTemplate }
    | (TemplateRenderFailure & { ok: false }) {
    const cached = this.cache.get(body,);
    if (cached) return { ok: true, template: cached, };

    let code: string;
    try {
      code = this.env.compile(body,).code;
    } catch (e) {
      return this.failure(e, body, "syntax",);
    }

    let template: CompiledTemplate;
    try {
      template = makeSyncTemplate(code, this.env,);
    } catch (e) {
      // `await` em função não-async ⇒ tag de I/O (include/layout/for await).
      const message = e instanceof Error ? e.message : String(e,);
      return {
        ok: false,
        kind: "async",
        message,
        position: 0,
        line: 1,
        column: 1,
      };
    }

    if (this.cache.size >= CACHE_LIMIT) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value,);
    }
    this.cache.set(body, template,);
    return { ok: true, template, };
  }

  /**
   * Renderiza `body` com `data` de forma síncrona.
   *
   * Erros de sintaxe, de tags assíncronas e de runtime voltam como
   * `TemplateRenderFailure` (sem `throw`): o chamador traduz para o
   * `MessageHandler` com o `SourceFileInfo` do `.tjp` original.
   */
  render(body: string, data: TemplateData = {},): TemplateRenderResult {
    const compiled = this.compile(body,);
    if (!compiled.ok) return compiled;

    try {
      const result = compiled.template(data,);
      return { ok: true, content: result.content ?? "", };
    } catch (e) {
      return this.failure(e, body, "runtime",);
    }
  }

  /** Descartar o cache (testes/uso em lote com corpos efêmeros). */
  clearCache(): void {
    this.cache.clear();
  }

  /** Converte um erro do Vento em `TemplateRenderFailure`. */
  private failure(
    error: unknown,
    body: string,
    kind: TemplateFailureKind,
  ): TemplateRenderFailure {
    const err = error as { message?: string; position?: number };
    const position = typeof err.position === "number" ? err.position : 0;
    const [line, column,] = lineColumnOf(body, position,);
    return {
      ok: false,
      kind,
      message: err.message ?? String(error,),
      position,
      line,
      column,
    };
  }
}

/** Instância única usada pelo scanner (e pelos testes via `renderTemplate`). */
export const templateEngine = new TemplateEngine();

/** Atalho: renderiza um corpo de template sem tocar na instância. */
export function renderTemplate(
  body: string,
  data: TemplateData = {},
): TemplateRenderResult {
  return templateEngine.render(body, data,);
}
