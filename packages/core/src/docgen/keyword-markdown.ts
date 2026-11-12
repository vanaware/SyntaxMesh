/**
 * `keyword-markdown.ts` — Markdown projection of a keyword documentation
 * (22.1b.3.21, 【novo — LSP-only】).
 *
 * Same content as {@link KeywordDocumentation.toText} rendered for the LSP
 * hover/help channel: `### keyword` title, bold labels, a ```tjp fence for
 * the syntax, **no ANSI** and **no attribute-tag legend** (the terminal
 * column layout does not apply to Markdown). There is no Ruby counterpart —
 * this is a SyntaxMesh-only projection, so it is not covered by the Ruby
 * goldens; the structure mirrors `toText` section by section.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco E
 */

import type { KeywordDocumentation, } from "./keyword-documentation.ts";

/**
 * Attribute tags (`[sc]`/`[ig]`/`[ip]`, combined with `:`) of one optional
 * attribute — same criterion as the `Attributes:` section of `toText`.
 */
function attributeTags(attr: KeywordDocumentation,): string {
  const tags: string[] = [];
  if (attr.scenarioSpecific) tags.push("sc",);
  if (attr.inheritedFromProject) tags.push("ig",);
  if (attr.inheritedFromParent) tags.push("ip",);
  return tags.length === 0 ? "" : `[${tags.join(":",)}]`;
}

/**
 * Renders the documentation of one keyword as Markdown (LSP hover/help).
 *
 * Sections, in order: title, support-level warning (when not `supported`),
 * purpose, syntax fence, arguments, context, attributes and see-also. A
 * `removed` keyword stops after the warning, exactly like `toText`.
 *
 * @param doc documentation built by the `SyntaxReference`.
 * @returns the Markdown page, terminated by a newline; never contains ANSI.
 */
export function keywordToMarkdown(doc: KeywordDocumentation,): string {
  const sections: string[] = [];

  sections.push(
    `### ${doc.keyword}${doc.listAttribute() ? " (List Attribute)" : ""}`,
  );

  if (doc.pattern.supportLevel !== "supported") {
    let warning = `**Warning:** ${doc.supportLevelMessage()}`;
    if (
      (doc.pattern.supportLevel === "deprecated" ||
        doc.pattern.supportLevel === "removed") &&
      doc.seeAlso.length > 0
    ) {
      warning += "\n\nPlease use " +
        doc.seeAlso.map((also,) => also.keyword).join(", ",) + " instead!";
    }
    sections.push(warning,);
    // Removed keyword: nothing beyond the warning (Ruby l.215).
    if (doc.pattern.supportLevel === "removed") {
      return sections.join("\n\n",) + "\n";
    }
  }

  sections.push(`**Purpose:** ${doc.purposeText()}`,);

  if (doc.syntax !== "[{ <attributes> }]") {
    sections.push("```tjp\n" + doc.syntax + "\n```",);

    if (doc.args.length === 0) {
      sections.push("**Arguments:** none",);
    } else {
      const items = doc.argumentTexts().map(
        ({ label, text, },) => `- **${label}:** ${text}`,
      );
      sections.push("**Arguments:**\n\n" + items.join("\n",),);
    }
  }

  sections.push(
    "**Context:** " +
      (doc.contexts.length === 0
        ? "Global scope"
        : doc.contexts.map((context,) => context.keyword).join(", ",)),
  );

  if (doc.optionalAttributes.length === 0) {
    sections.push("**Attributes:** none",);
  } else {
    const sorted = [...doc.optionalAttributes,].sort((a, b,) =>
      a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0
    );
    const list = sorted
      .map((attr,) => attr.keyword + attributeTags(attr,))
      .join(", ",);
    sections.push(`**Attributes:** ${list}`,);
  }

  if (doc.seeAlso.length > 0) {
    sections.push(
      "**See also:** " + doc.seeAlso.map((also,) => also.keyword).join(", ",),
    );
  }

  return sections.join("\n\n",) + "\n";
}
