/**
 * URLParameter — codificação de parâmetros de URL de relatórios interativos
 * (Fase 14.24, port de `URLParameter.rb`).
 *
 * Ruby: `encode(data) = [Zlib::Deflate.deflate(data)].pack('m')` — zlib +
 * Base64. Aqui o core é browser-only e síncrono (`to_html` não pode ser
 * async), então `CompressionStream` não é utilizável. Implementamos o
 * **stream zlib ([RFC 1950]) com stored blocks (BTYPE=00, sem compressão)
 * + Adler-32**, que é um deflate zlib válido: `Zlib::Inflate.inflate`
 * (Ruby) e `DecompressionStream("deflate")` leem a saída normalmente
 * (testado em `url-parameter_test.ts`). O byte-a-byte com o level 9 do
 * Ruby não importa — a URL nunca é comparada como oracle.
 *
 * Divergências documentadas:
 *   • `pack('m')` do Ruby quebra o Base64 em linhas de 60 chars; emitimos
 *     Base64 sem quebras (seguro para contexto de URL).
 *   • `decode` aceita Base64 com quebras/quebras de linha (o `pack('m')` do
 *     Ruby as produz) e usa `fflate` (`unzlibSync`) — o `decode` síncrono é
 *     pré-requisito da Fase 20 (PWA interativa lê parâmetros da URL).
 *
 * `encode` continua usando stored blocks (determinístico e sem dependência de
 * compressor); `decode` entende **qualquer** deflate zlib, inclusive o
 * level-9 do Ruby.
 *
 * @see docs/taskjuggler/lib/taskjuggler/URLParameter.rb
 * @see ADR 027 (reports browser-only, retornam strings)
 */

import { unzlibSync, } from "fflate";

/** Soma de verificação Adler-32 (RFC 1950 §8.3). */
function adler32(bytes: Uint8Array,): number {
  let a1 = 1;
  let a2 = 0;
  for (const b of bytes) {
    a1 = (a1 + b) % 65521;
    a2 = (a2 + a1) % 65521;
  }
  return ((a2 << 16) | a1) >>> 0;
}

/**
 * Stream zlib com blocos "stored" (sem compressão): cabeçalho 0x78 0x01
 * (CM=8, CINFO=7, FLEVEL=0, FCHECK válido), blocos de até 65535 bytes
 * (BFINAL no último; LEN/NLEN little-endian) e Adler-32 big-endian.
 */
function storedDeflate(bytes: Uint8Array,): Uint8Array {
  const out: number[] = [0x78, 0x01,];
  const max = 0xffff;
  let offset = 0;
  if (bytes.length === 0) {
    // Bloco final vazio: BFINAL=1/BTYPE=00, LEN=0, NLEN=65535.
    out.push(0x01, 0x00, 0x00, 0xff, 0xff,);
  }
  while (offset < bytes.length) {
    const len = Math.min(max, bytes.length - offset,);
    const last = offset + len >= bytes.length;
    out.push(last ? 0x01 : 0x00, len & 0xff, (len >>> 8) & 0xff,);
    out.push((~len) & 0xff, ((~len) >>> 8) & 0xff,);
    for (let i = 0; i < len; i++) out.push(bytes[offset + i]!,);
    offset += len;
  }
  const ad = adler32(bytes,);
  out.push(
    (ad >>> 24) & 0xff,
    (ad >>> 16) & 0xff,
    (ad >>> 8) & 0xff,
    ad & 0xff,
  );
  return Uint8Array.from(out,);
}

export class URLParameter {
  /**
   * Codifica `data` como Base64 de um stream zlib (equivalente funcional do
   * `URLParameter.encode` do Ruby — ver cabeçalho do arquivo).
   */
  static encode(data: string,): string {
    const deflated = storedDeflate(new TextEncoder().encode(data,),);
    let binary = "";
    for (const b of deflated) binary += String.fromCharCode(b,);
    return btoa(binary,);
  }

  /**
   * Decodifica o Base64+zlib produzido por {@link encode} (ou pelo
   * `URLParameter.encode` do Ruby).
   *
   * Espaços/quebras de linha do Base64 são ignorados (`pack('m')` do Ruby
   * quebra em 60 colunas).
   */
  static decode(data: string,): string {
    const clean = data.replace(/\s+/g, "",);
    if (clean === "") return "";
    const raw = Uint8Array.from(atob(clean,), (c,) => c.charCodeAt(0,),);
    return new TextDecoder().decode(unzlibSync(raw,),);
  }
}
