/**
 * URLParameter — encoding of the URL parameters of interactive reports
 * (phase 14.24, port of `URLParameter.rb`).
 *
 * Ruby: `encode(data) = [Zlib::Deflate.deflate(data)].pack('m')` — zlib +
 * Base64. Here the core is browser-only and synchronous (`to_html` cannot be
 * async), so `CompressionStream` is not usable. We implement the
 * **zlib stream ([RFC 1950]) with stored blocks (BTYPE=00, no compression)
 * + Adler-32**, which is a valid zlib deflate: `Zlib::Inflate.inflate`
 * (Ruby) and `DecompressionStream("deflate")` read the output normally
 * (tested in `url-parameter_test.ts`). Byte-for-byte equality with Ruby's
 * level 9 does not matter — the URL is never compared as an oracle.
 *
 * Documented divergences:
 *   • Ruby's `pack('m')` breaks Base64 into 60-character lines; we emit
 *     Base64 without line breaks (safe for a URL context).
 *   • `decode` accepts Base64 with line breaks (Ruby's `pack('m')` produces
 *     them) and uses `fflate` (`unzlibSync`) — the synchronous `decode` is a
 *     prerequisite of phase 20 (the interactive PWA reads parameters from the
 *     URL).
 *
 * `encode` keeps using stored blocks (deterministic and free of a compressor
 * dependency); `decode` understands **any** zlib deflate, including Ruby's
 * level 9.
 *
 * @see docs/taskjuggler/lib/taskjuggler/URLParameter.rb
 * @see ADR 027 (reports browser-only, return strings)
 */

import { unzlibSync, } from "fflate";

/**
 * Adler-32 checksum (RFC 1950 §8.3).
 *
 * @param bytes Buffer whose checksum is computed.
 * @returns The checksum as an unsigned 32-bit integer.
 */
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
 * zlib stream with "stored" blocks (no compression): header 0x78 0x01
 * (CM=8, CINFO=7, FLEVEL=0, valid FCHECK), blocks of up to 65535 bytes
 * (BFINAL on the last one; LEN/NLEN little-endian) and a big-endian Adler-32.
 *
 * @param bytes Payload to wrap.
 * @returns The zlib stream containing the payload uncompressed.
 */
function storedDeflate(bytes: Uint8Array,): Uint8Array {
  const out: number[] = [0x78, 0x01,];
  const max = 0xffff;
  let offset = 0;
  if (bytes.length === 0) {
    // Empty final block: BFINAL=1/BTYPE=00, LEN=0, NLEN=65535.
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

/** zlib + Base64 codec for the parameters of interactive report URLs. */
export class URLParameter {
  /**
   * Encodes `data` as Base64 of a zlib stream (functional equivalent of
   * Ruby's `URLParameter.encode` — see the file header).
   *
   * @param data Text to encode.
   * @returns The Base64 string carrying the zlib stream.
   */
  static encode(data: string,): string {
    const deflated = storedDeflate(new TextEncoder().encode(data,),);
    let binary = "";
    for (const b of deflated) binary += String.fromCharCode(b,);
    return btoa(binary,);
  }

  /**
   * Decodes the Base64+zlib produced by {@link encode} (or by Ruby's
   * `URLParameter.encode`).
   *
   * Spaces and line breaks in the Base64 are ignored (Ruby's `pack('m')`
   * wraps at 60 columns).
   *
   * @param data Base64 string to decode.
   * @returns The original text, or an empty string for empty input.
   */
  static decode(data: string,): string {
    const clean = data.replace(/\s+/g, "",);
    if (clean === "") return "";
    const raw = Uint8Array.from(atob(clean,), (c,) => c.charCodeAt(0,),);
    return new TextDecoder().decode(unzlibSync(raw,),);
  }
}
