/**
 * 16.2 — `JournalEntryList` (Ruby `JournalEntryList`, `Journal.rb` l.193-337).
 *
 * A lista é um "Array com twist": ordena-se sozinha antes de qualquer leitura
 * (`get`/`first`/`last`/iteração) e o critério default é
 * `date ASC, alert ASC, seqno ASC`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.2)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { Journal, JournalEntry, } from "../../src/model/journal.ts";
import {
  JOURNAL_SORTING_ATTRIBUTES,
  JournalEntryList,
} from "../../src/model/journal-entry-list.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Cria uma entrada solta (sem propriedade → `seqno` 0). */
function entry(
  journal: Journal,
  date: string,
  headline = "H",
  alertLevel = 0,
): JournalEntry {
  const e = new JournalEntry(journal, D(date,), headline, null,);
  e.alertLevel = alertLevel;
  return e;
}

describe("JournalEntryList (contadores)", () => {
  let journal: Journal;
  let list: JournalEntryList;

  beforeEach(() => {
    journal = new Journal();
    list = new JournalEntryList();
  },);

  it("começa vazia", () => {
    assertEquals(list.count(), 0,);
    assertEquals(list.length(), 0,);
    assert(list.empty(),);
  });

  it("push conta e marca não-ordenada", () => {
    list.push(entry(journal, "2026-01-02",),);
    list.push(entry(journal, "2026-01-01",),);
    assertEquals(list.count(), 2,);
    assertEquals(list.length(), 2,);
    assert(!list.empty(),);
  });

  it("add concatena outra lista e devolve this (Ruby +)", () => {
    const other = new JournalEntryList();
    other.push(entry(journal, "2026-01-03",),);
    const ret = list.push(entry(journal, "2026-01-01",),).add(other,);
    assertEquals(ret, list,);
    assertEquals(list.count(), 2,);
  });
});

describe("JournalEntryList (busca e remoção)", () => {
  let journal: Journal;
  let list: JournalEntryList;

  beforeEach(() => {
    journal = new Journal();
    list = new JournalEntryList();
  },);

  it("include reconhece membros", () => {
    const e = entry(journal, "2026-01-01",);
    list.push(e,);
    assert(list.include(e,),);
    assert(!list.include(entry(journal, "2026-01-01",),),);
  });

  it("delete remove e informa se removeu", () => {
    const e = entry(journal, "2026-01-01",);
    list.push(e,);
    assert(list.delete(e,),);
    assert(!list.delete(e,),);
    assertEquals(list.count(), 0,);
  });

  it("deleteIf remove por predicado", () => {
    list.push(entry(journal, "2026-01-01", "a",),);
    list.push(entry(journal, "2026-01-02", "b",),);
    list.deleteIf((e,) => e.headline === "a");
    assertEquals(list.count(), 1,);
    assertEquals(list.first()!.headline, "b",);
  });

  it("get devolve por índice ordenado e null fora de faixa", () => {
    list.push(entry(journal, "2026-01-03",),);
    list.push(entry(journal, "2026-01-01",),);
    assertEquals(list.get(0,)!.date.compareTo(D("2026-01-01",),), 0,);
    assertEquals(list.get(9,), null,);
  });

  it("first devolve null quando vazia", () => {
    assertEquals(list.first(), null,);
  });
});

describe("JournalEntryList (ordenação)", () => {
  let journal: Journal;

  beforeEach(() => {
    journal = new Journal();
  },);

  it("ordena por data ascendente por default", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-02-01",),);
    list.push(entry(journal, "2026-01-01",),);
    list.push(entry(journal, "2026-03-01",),);
    const got = list.toArray().map((e,) => e.date);
    const want = ["2026-01-01", "2026-02-01", "2026-03-01",].map(D,);
    assertEquals(got.length, want.length,);
    got.forEach((d, i,) => assertEquals(d.compareTo(want[i]!,), 0,));
  });

  it("desempata por alertLevel ascendente", () => {
    const list = new JournalEntryList();
    const red = entry(journal, "2026-01-01", "red", 2,);
    const green = entry(journal, "2026-01-01", "green", 0,);
    const yellow = entry(journal, "2026-01-01", "yellow", 1,);
    list.push(red,).push(green,).push(yellow,);
    assertEquals(
      list.toArray().map((e,) => e.headline),
      ["green", "yellow", "red",],
    );
  });

  it("setSorting por alert desc invertido", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-01", "green", 0,),);
    list.push(entry(journal, "2026-01-01", "red", 2,),);
    list.setSorting([["alert", -1,],],);
    assertEquals(list.toArray()[0]!.headline, "red",);
  });

  it("setSorting rejeita atributo desconhecido", () => {
    const list = new JournalEntryList();
    assertThrows(
      () => list.setSorting([["author", 1,] as never,],),
      Error,
      "Unknown attribute author",
    );
  });

  it("setSorting rejeita direção inválida", () => {
    const list = new JournalEntryList();
    assertThrows(
      () => list.setSorting([["date", 0,] as never,],),
      Error,
      "Unknown direction 0",
    );
  });

  it("JOURNAL_SORTING_ATTRIBUTES é o conjunto do Ruby", () => {
    assertEquals([...JOURNAL_SORTING_ATTRIBUTES,], [
      "alert",
      "date",
      "seqno",
    ],);
  });

  it("sort é idempotente e devolve this", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-02",),);
    list.push(entry(journal, "2026-01-01",),);
    assertEquals(list.sort(), list,);
    assertEquals(list.sort(), list,);
    assertEquals(list.get(0,)!.date.compareTo(D("2026-01-01",),), 0,);
  });

  it("uniq remove duplicatas preservando a ordem", () => {
    const list = new JournalEntryList();
    const a = entry(journal, "2026-01-01", "a",);
    const b = entry(journal, "2026-01-02", "b",);
    list.push(a,).push(b,).push(a,);
    list.uniq();
    assertEquals(list.count(), 2,);
    assertEquals(list.toArray().map((e,) => e.headline), ["a", "b",],);
  });
});

describe("JournalEntryList#last", () => {
  let journal: Journal;

  beforeEach(() => {
    journal = new Journal();
  },);

  it("devolve todas as entradas da data mais recente antes do corte", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-01", "velha",),);
    list.push(entry(journal, "2026-01-05", "mesma-a",),);
    list.push(entry(journal, "2026-01-05", "mesma-b",),);
    list.push(entry(journal, "2026-01-09", "futura",),);
    const last = list.last(D("2026-01-05",),);
    assertEquals(
      last.toArray().map((e,) => e.headline),
      ["mesma-a", "mesma-b",],
    );
  });

  it("só uma entrada quando as datas diferem", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-01",),);
    list.push(entry(journal, "2026-01-02",),);
    assertEquals(list.last(D("2026-12-31",),).count(), 1,);
  });

  it("lista vazia continua vazia", () => {
    assertEquals(new JournalEntryList().last(D("2026-01-01",),).count(), 0,);
  });

  it("sem data devolve o grupo mais recente (divergência Category A)", () => {
    // Ruby: `e.date <= nil` → NoMethodError. O port devolve o grupo mais novo.
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-01", "velha",),);
    list.push(entry(journal, "2026-02-01", "nova",),);
    assertEquals(list.last().toArray().map((e,) => e.headline), ["nova",],);
  });

  it("corte antes de todas as entradas devolve vazio", () => {
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-05",),);
    assertEquals(list.last(D("2026-01-01",),).count(), 0,);
  });
});

describe("JournalEntryList (iteração)", () => {
  it("itera na ordem de ordenação", () => {
    const journal = new Journal();
    const list = new JournalEntryList();
    list.push(entry(journal, "2026-01-02", "b",),);
    list.push(entry(journal, "2026-01-01", "a",),);
    assertEquals([...list,].map((e,) => e.headline), ["a", "b",],);
  });
});
