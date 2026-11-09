/**
 * 22.1b.1 — `TernarySearchTree` (Ruby `TernarySearchTree.rb`, 206 linhas).
 *
 * Cobre os quatro pontos que a árvore precisa garantir para os consumidores
 * (`syntaxmesh man` e o `doc-core`): inserção fiel, busca exata, busca por
 * prefixo em ordem alfabética e balanceamento.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TernarySearchTree.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco C
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { TernarySearchTree, } from "../../src/utils/ternary-search-tree.ts";

describe("TernarySearchTree — construção (22.1b.1.2)", () => {
  it("sem argumento cria árvore vazia", () => {
    const tree = new TernarySearchTree();
    assertEquals(tree.length(), 0,);
    assertEquals(tree.toArray(), [],);
    assertEquals(tree.maxDepth(), 0,);
    assertEquals(tree.value, null,);
  });

  it("com uma palavra insere só ela", () => {
    const tree = new TernarySearchTree("task",);
    assertEquals(tree.length(), 1,);
    assertEquals(tree.find("task",), "task",);
  });

  it("com lista insere todos os elementos", () => {
    const tree = new TernarySearchTree(["task", "resource", "account",],);
    assertEquals(tree.length(), 3,);
    assertEquals(tree.toArray(), ["account", "resource", "task",],);
  });
});

describe("TernarySearchTree — insert (22.1b.1.3/1.4)", () => {
  it("insere menor, igual e maior no mesmo índice", () => {
    const tree = new TernarySearchTree();
    tree.insert("b",);
    tree.insert("a",);
    tree.insert("c",);
    assertEquals(tree.toArray(), ["a", "b", "c",],);
  });

  it("compartilha prefixo e marca o fim das duas palavras", () => {
    const tree = new TernarySearchTree(["task", "tasks",],);
    assertEquals(tree.length(), 2,);
    assertEquals(tree.find("task",), "task",);
    assertEquals(tree.find("tasks",), "tasks",);
  });

  it("recusa inserção nula", () => {
    const tree = new TernarySearchTree();
    assertThrows(
      () => tree.insert(null as unknown as string,),
      Error,
      "Cannot insert nil or empty lists",
    );
  });

  it("recusa inserção vazia", () => {
    assertThrows(
      () => new TernarySearchTree("",),
      Error,
      "Cannot insert nil or empty lists",
    );
  });

  it("recusa índice fora de faixa", () => {
    const tree = new TernarySearchTree<string>("a",);
    assertThrows(
      () => tree.insert("abc", 3,),
      Error,
      "index out of range [0..2]",
    );
    assertThrows(
      () => tree.insert("abc", -1,),
      Error,
      "index out of range [0..2]",
    );
  });

  it("insertList e add equivalem a insert", () => {
    const tree = new TernarySearchTree();
    tree.insertList(["task", "resource",],);
    tree.add("account",);
    assertEquals(tree.toArray(), ["account", "resource", "task",],);
  });
});

describe("TernarySearchTree — find (22.1b.1.5)", () => {
  it("encontra palavra exata", () => {
    const tree = new TernarySearchTree(["task", "resource",],);
    assertEquals(tree.find("task",), "task",);
  });

  it("devolve null para palavra ausente", () => {
    const tree = new TernarySearchTree(["task",],);
    assertEquals(tree.find("tasks",), null,);
    assertEquals(tree.find("t",), null,);
    assertEquals(tree.find("xyz",), null,);
  });

  it("devolve null em árvore vazia e para string vazia", () => {
    const tree = new TernarySearchTree();
    assertEquals(tree.find("task",), null,);
    assertEquals(tree.find("",), null,);
  });

  it("prefixo com uma correspondência devolve lista de um", () => {
    const tree = new TernarySearchTree(["task", "resource",],);
    assertEquals(tree.find("tas", true,), ["task",],);
  });

  it("prefixo com várias correspondências vem em ordem alfabética", () => {
    const tree = new TernarySearchTree(
      ["task", "tasks", "taskreport", "resource",],
    );
    assertEquals(
      tree.find("task", true,),
      ["task", "taskreport", "tasks",],
    );
  });

  it("prefixo exato inclui o próprio elemento", () => {
    const tree = new TernarySearchTree(["task", "tasks",],);
    assertEquals(tree.find("task", true,), ["task", "tasks",],);
  });

  it("prefixo inexistente devolve null", () => {
    const tree = new TernarySearchTree(["task",],);
    assertEquals(tree.find("zzz", true,), null,);
  });
});

describe("TernarySearchTree — collect e ordem (22.1b.1.6)", () => {
  it("percorre em ordem alfabética", () => {
    const tree = new TernarySearchTree(["c", "a", "b",],);
    assertEquals(tree.collect(null, (v,) => v,), ["a", "b", "c",],);
  });

  it("aplica a função a cada elemento", () => {
    const tree = new TernarySearchTree(["a", "ab",],);
    assertEquals(tree.collect(null, (v,) => v.length,), [1, 2,],);
  });

  it("aceita prefixo inicial", () => {
    const tree = new TernarySearchTree(["a", "b",],);
    // O `newStr` entregue à função já vem com o prefixo acumulado.
    assertEquals(tree.collect("x", (v,) => v,), ["xa", "xb",],);
  });
});

describe("TernarySearchTree — métricas (22.1b.1.7)", () => {
  it("length conta elementos, não nós", () => {
    const tree = new TernarySearchTree(["task", "tasks", "taskreport",],);
    assertEquals(tree.length(), 3,);
  });

  it("maxDepth cresce com o comprimento", () => {
    const tree = new TernarySearchTree(["ab",],);
    assertEquals(tree.maxDepth(), 2,);
  });

  it("maxDepth é 0 na árvore vazia", () => {
    assertEquals(new TernarySearchTree().maxDepth(), 0,);
  });
});

describe("TernarySearchTree — balanceamento (22.1b.1.8/1.9)", () => {
  it("toArray faz round-trip pela lista ordenada", () => {
    const words = ["task", "resource", "account", "shift", "report",];
    const tree = new TernarySearchTree(words,);
    assertEquals(tree.toArray(), [...words,].sort(),);
  });

  it("balanced devolve árvore equivalente", () => {
    const tree = new TernarySearchTree(
      ["task", "resource", "account", "shift", "report", "scenario",],
    );
    const balanced = tree.balanced();
    assertEquals(balanced.toArray(), tree.toArray(),);
    assert(balanced.maxDepth() <= tree.maxDepth(),);
  });

  it("balance reduz a profundidade da árvore inserida em ordem", () => {
    const ordered = ["a", "b", "c", "d", "e", "f", "g", "h",];
    const tree = new TernarySearchTree();
    tree.insertList(ordered,);
    const before = tree.maxDepth();
    tree.balance();
    assertEquals(tree.toArray(), ordered,);
    assert(tree.maxDepth() < before,);
  });

  it("balance é idempotente", () => {
    const tree = new TernarySearchTree(["d", "b", "f", "a", "c", "e", "g",],);
    tree.balance();
    const depth = tree.maxDepth();
    tree.balance();
    assertEquals(tree.maxDepth(), depth,);
    assertEquals(tree.toArray(), ["a", "b", "c", "d", "e", "f", "g",],);
  });
});
