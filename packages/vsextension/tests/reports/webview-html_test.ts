/**
 * Unit tests of the pure Webview renderer (22.6.3). BDD + `@std/assert`,
 * no `vscode` runtime — structural assertions over the emitted HTML.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { renderWebviewHtml, } from "../../src/reports/webview-html.ts";

const CSP_SOURCE = "vscode-webview-resource://abc123";

describe("renderWebviewHtml", () => {
  it("emits a strict CSP bound to the Webview cspSource", () => {
    const html = renderWebviewHtml("<p>hi</p>", {}, CSP_SOURCE, "n0nce",);
    assert(html.includes("Content-Security-Policy",),);
    assert(html.includes("default-src 'none'",),);
    assert(html.includes(CSP_SOURCE,),);
    assert(html.includes("'nonce-n0nce'",),);
    assert(html.includes(`<script nonce="n0nce">`,),);
  });

  it("rewrites asset references to Webview resource URIs", () => {
    const content = `<link rel="stylesheet" href="css/tjreport.css">`;
    const assets = { "css/tjreport.css": `${CSP_SOURCE}/css/tjreport.css`, };
    const html = renderWebviewHtml(content, assets, CSP_SOURCE,);
    assert(html.includes(`${CSP_SOURCE}/css/tjreport.css`,),);
    assertEquals(html.includes(`href="css/tjreport.css"`,), false,);
  });

  it("embeds the report content and the Save button", () => {
    const html = renderWebviewHtml("<h1>Overview</h1>", {}, CSP_SOURCE,);
    assert(html.includes("<h1>Overview</h1>",),);
    assert(html.includes(`id="smx-save"`,),);
    assert(html.includes("acquireVsCodeApi()",),);
  });
});
