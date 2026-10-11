import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { AccountCredit } from "../../src/finance/account-credit.ts";
import { TjTime } from "../../src/time/tj-time.ts";
import { deepClone, } from "../../src/utils/deep-clone.ts";

describe("AccountCredit", () => {
  it("armazena date, description, amount", () => {
    const date = TjTime.fromString("2026-03-15");
    const description = "Bonus";
    const amount = 5000;
    const credit = new AccountCredit(date, description, amount);
    assertEquals(credit.date.toString(), "2026-03-15");
    assertEquals(credit.description, description);
    assertEquals(credit.amount, amount);
  });

  it("valores negativos aceitos", () => {
    const date = TjTime.fromString("2026-03-15");
    const description = "Penalty";
    const amount = -500;
    const credit = new AccountCredit(date, description, amount);
    assertEquals(credit.amount, amount);
  });

  it("compatível com deepClone (imutável)", () => {
    const date = TjTime.fromString("2026-03-15");
    const description = "Bonus";
    const amount = 5000;
    const credit = new AccountCredit(date, description, amount);
    const credit2 = deepClone(credit);
    assertEquals(credit2, credit);
  });
});