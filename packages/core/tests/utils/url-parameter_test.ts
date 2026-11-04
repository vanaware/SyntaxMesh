/**
 * URLParameter.encode (14.24.6) — o stream zlib emitado (stored blocks +
 * Adler-32 + Base64) precisa ser um zlib válido: round-trip via
 * `DecompressionStream("deflate")` cobre o mesmo inflater que Ruby usa em
 * `URLParameter.decode`.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { URLParameter, } from "../../src/utils/url-parameter.ts";

/** Decodifica o Base64+zlib produzido por `URLParameter.encode`. */
async function decode(encoded: string,): Promise<string> {
  assert(/^[A-Za-z0-9+/=]+$/.test(encoded,), "deveria ser Base64 limpo",);
  const raw = Uint8Array.from(atob(encoded,), (c,) => c.charCodeAt(0,),);
  const stream = new Blob([raw,],).stream().pipeThrough(
    new DecompressionStream("deflate",),
  );
  const buf = await new Response(stream,).arrayBuffer();
  return new TextDecoder().decode(buf,);
}

describe("URLParameter.encode (14.24.6)", () => {
  it("round-trip de string ASCII", async () => {
    const data = "project=test;report=overview;attributes=<-name->";
    assertEquals(await decode(URLParameter.encode(data,),), data,);
  });

  it("round-trip da string vazia", async () => {
    assertEquals(await decode(URLParameter.encode("",),), "",);
  });

  it("round-trip de UTF-8 com acentos", async () => {
    const data = "Missão § 1000 — ☕";
    assertEquals(await decode(URLParameter.encode(data,),), data,);
  });

  it("round-trip de payload > 65535 bytes (múltiplos stored blocks)", async () => {
    const data = "aç".repeat(50_000,); // > 100 KB em UTF-8
    assertEquals(await decode(URLParameter.encode(data,),), data,);
  });
});

/**
 * Fixtures geradas pelo Ruby real:
 * `ruby -rzlib -e 'puts [Zlib::Deflate.deflate(DATA)].pack("m")'`.
 *
 * São deflate zlib level-9 (Huffman), não stored blocks — é exatamente a
 * saída que o `URLParameter.encode` do tj3 produz na URL.
 */
const RUBY_UTF8 = "eJzzzSwuPrw4X+HQcgVDAwMDhUcNUxQezZgKAHXKCiE=";
const RUBY_EMPTY = "eJwDAAAAAAE=";

describe("URLParameter.decode (16.8)", () => {
  it("decodifica o que encode produziu", () => {
    const data = "project=test;report=overview";
    assertEquals(URLParameter.decode(URLParameter.encode(data,),), data,);
  });

  it("decodifica zlib level-9 do Ruby (UTF-8)", () => {
    assertEquals(URLParameter.decode(RUBY_UTF8,), "Missão § 1000 — ☕",);
  });

  it("decodifica zlib vazio do Ruby", () => {
    assertEquals(URLParameter.decode(RUBY_EMPTY,), "",);
  });

  it("ignora quebras de linha do pack('m')", () => {
    const quebrado = RUBY_UTF8.replace(/(.{10})/g, "$1\n",);
    assertEquals(URLParameter.decode(quebrado,), "Missão § 1000 — ☕",);
  });

  it("string vazia devolve string vazia", () => {
    assertEquals(URLParameter.decode("",), "",);
  });

  it("round-trip de string longa (UTF-8 até 200 KB)", () => {
    const data = "çãõ ".repeat(20_000,);
    assertEquals(URLParameter.decode(URLParameter.encode(data,),), data,);
  });
});
