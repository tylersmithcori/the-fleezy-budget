import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM, type DOMWindow } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(path.resolve(process.cwd(), "public/budget.html"), "utf8");

function openTool() {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window: DOMWindow) {
      window.scrollTo = () => {};
    },
  });
  return dom.window.document;
}

type EventCtor = new (type: string, init?: { bubbles?: boolean }) => unknown;
function fire(doc: Document, node: Element, type: string) {
  const view = doc.defaultView as unknown as { Event: EventCtor };
  node.dispatchEvent(new view.Event(type, { bubbles: true }) as Event);
}
const el = (doc: Document, id: string) => doc.getElementById(id) as HTMLInputElement;
const text = (doc: Document, id: string) => doc.getElementById(id)!.textContent!;

function addIncome(doc: Document, name: string, amt: string) {
  el(doc, "incName").value = name;
  el(doc, "incAmt").value = amt;
  fire(doc, doc.getElementById("incomeForm")!, "submit");
}
function addBill(doc: Document, name: string, amt: string, day: string, owed = "") {
  el(doc, "tplName").value = name;
  el(doc, "tplAmt").value = amt;
  el(doc, "tplDay").value = day;
  el(doc, "tplOwed").value = owed;
  fire(doc, doc.getElementById("templateForm")!, "submit");
}

describe("Payoff bills", () => {
  it("checking a payoff bill paid lowers what's owed by that month's payment", () => {
    const doc = openTool();
    addBill(doc, "Car note", "300", "5", "6000");
    expect(text(doc, "payOwed")).toContain("$6,000");
    const box = doc.querySelector("#billMonthList input[type=checkbox]") as HTMLInputElement;
    box.checked = true;
    fire(doc, box, "change");
    expect(text(doc, "payOwed")).toContain("$5,700");
  });

  it("combines monthly payments and total owed across payoff bills only", () => {
    const doc = openTool();
    addBill(doc, "Car note", "300", "5", "6000");
    addBill(doc, "Card", "100", "10", "2000");
    addBill(doc, "Rent", "1000", "1");
    expect(text(doc, "payMonthly")).toContain("$400");
    expect(text(doc, "payOwed")).toContain("$8,000");
  });
});

describe("Pay yourself first", () => {
  it("takes a percent of everything you make off the top", () => {
    const doc = openTool();
    addIncome(doc, "Job", "2000");
    addIncome(doc, "Side", "1000");
    el(doc, "saveVal").value = "10";
    fire(doc, el(doc, "saveVal"), "input");
    addBill(doc, "Rent", "1000", "1");
    expect(text(doc, "prioSpend")).toContain("$1,700");
  });

  it("takes a set amount each time income comes in", () => {
    const doc = openTool();
    addIncome(doc, "Job", "2000");
    addIncome(doc, "Side", "1000");
    el(doc, "saveMode").value = "amt";
    fire(doc, el(doc, "saveMode"), "change");
    el(doc, "saveVal").value = "50";
    fire(doc, el(doc, "saveVal"), "input");
    expect(text(doc, "prioSpend")).toContain("$2,900");
  });

  it("covers bills in priority order and flags the ones money runs out for", () => {
    const doc = openTool();
    addIncome(doc, "Job", "1000");
    el(doc, "saveVal").value = "0";
    fire(doc, el(doc, "saveVal"), "input");
    addBill(doc, "Phone", "100", "1");
    addBill(doc, "Rent", "950", "1");
    // Move Rent to #1
    (doc.querySelectorAll("#templateList [data-action=move-up]")[1] as HTMLElement).click();
    const rows = Array.from(doc.querySelectorAll("#prioList .row")).map((r) => r.textContent!);
    expect(rows[2]).toContain("Rent");
    expect(rows[2]).toContain("Covered");
    expect(rows[3]).toContain("Phone");
    expect(rows[3]).toContain("Short $50");
  });
});

describe("EBT Benefits", () => {
  it("preserves parked benefits on unrelated saves without counting them as cash", () => {
    const dom = new JSDOM(html, { url: 'http://localhost/budget.html?account=1', runScripts: 'dangerously', beforeParse(w) { w.scrollTo = () => {}; } });
    const bridge = (dom.window as unknown as { budgetAccount: { set: (value: unknown) => void; onSave?: (value: { ebtAmt: Record<string, number>; ebtExp: unknown[] }) => void } }).budgetAccount;
    const month = new Date().toISOString().slice(0, 7);
    bridge.set({ incomes: [], templates: [], expenses: [], accounts: [], received: [], paid: {}, saveMode: 'pct', saveVal: 0, showWeekly: false, notifyOn: false, notified: {}, ebtAmt: { [month]: 400 }, ebtExp: [{ id: 'parked', amount: 120, month }] });
    let saved: { ebtAmt: Record<string, number>; ebtExp: unknown[] } | undefined;
    bridge.onSave = value => { saved = value; };
    addIncome(dom.window.document, 'Job', '1000');
    expect(saved?.ebtAmt[month]).toBe(400);
    expect(saved?.ebtExp).toHaveLength(1);
    expect(text(dom.window.document, 'statIncome')).toBe('$1,000');
    expect(text(dom.window.document, 'statLeft')).toBe('$1,000');
    dom.window.close();
  });
});
