---
title: "🏝️ Islands guide"
icon: "widgets"
date: "2026-10-09"
author: "SyntaxMesh Team"
tags:
  - "islands"
  - "preact"
  - "signals"
  - "hydration"
description: "Complete guide to the interactive island architecture of mdBlog with HTML+ES and Preact Signals."
location: "#/articles/islands.md"
---

# 🏝 Islands in mdBlog

The **Islands** model (Interactivity Islands) in mdBlog lets you place reactive,
dynamic components inside essentially static Markdown documents without
overloading the page with unnecessary JavaScript.

---

## 🎯 Core principles

1. **Selective and idempotent hydration:**
   Only the elements marked with `[data-island]` are hydrated. Everything else (headings, paragraphs, lists) stays purely static.

2. **Zero prior compilation:**
   Islands live as plain `.js` files in `public/islands/` and are loaded on demand by the browser through the native asynchronous `import()`.

3. **A framework-agnostic, safe Wire Format:**
   In the AST an island is only safe JSON metadata: `{ t: "i", n: "Counter.js", p: { start: 10 } }`. No closure or function ever travels through the pipeline.

4. **State isolation:**
   Each island instance works autonomously with its own `@preact/signals`.

---

## 💻 Syntaxes supported in Markdown

### 1. Directive syntax

Ideal for simple components and literal values on a single line:

```markdown
::Counter.js{start: 25, step: 5, label: "My Counter"}
```

### 2. Code block syntax

Ideal for objects with several properties or structured JSON data:

````markdown
```island:Counter.js
{
  "start": 50,
  "step": 10,
  "label": "Batched Counter"
}
```
````

---

## 🔬 How the hydration cycle works

1. **Markers generated in the DOM:**
   When `wireToVNode()` handles an island node (`t: "i"`), it emits a container with data attributes:
   ```html
   <div data-island="Counter.js" data-props='{"start": 10, "step": 1}'></div>
   ```

2. **Sweep by `hydrateIslands()`:**
   After the reader renders, `hydrateIslands()` finds every `[data-island]` element not initialized yet.

3. **Dynamic import:**
   The browser imports the `./islands/Counter.js` module on demand and mounts the Preact component straight into the container, with the props deserialized from `data-props`.

4. **In-memory cache:**
   Once loaded, the component is kept in the in-memory island cache (`dynamicIslandsCache`), so future navigations mount it instantly.
