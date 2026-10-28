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

function addAccount(doc: Document, name: string, kind: string, bal: string) {
  el(doc, "acctName").value = name;
  el(doc, "acctKind").value = kind;
  el(doc, "acctBal").value = bal;
  fire(doc, doc.getElementById("acctForm")!, "submit");
}
function editAndSave(doc: Document, btn: Element, name: string, amt: string) {
  (btn as HTMLElement).click();
  el(doc, "eName").value = name;
  el(doc, "eAmt").value = amt;
  fire(doc, doc.getElementById("editForm")!, "submit");
}

describe("Multiple balance accounts", () => {
  it("shows each account with its own balance", () => {
    const doc = openTool();
    addAccount(doc, "Main checking", "checking", "1200");
    addAccount(doc, "Rainy day", "savings", "500");
    const cards = Array.from(doc.querySelectorAll("#acctGrid .acct")).map((c) => c.textContent!);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain("Main checking");
    expect(cards[0]).toContain("$1,200");
    expect(cards[1]).toContain("Rainy day");
    expect(cards[1]).toContain("$500");
  });
});

describe("Edit buttons", () => {
  it("edits an income's name and amount and updates the total", () => {
    const doc = openTool();
    el(doc, "incName").value = "Mian job";
    el(doc, "incAmt").value = "2000";
    fire(doc, doc.getElementById("incomeForm")!, "submit");
    editAndSave(doc, doc.querySelector("#incomeList [data-action=edit]")!, "Main job", "2500");
    expect(text(doc, "incomeList")).toContain("Main job");
    expect(text(doc, "statIncome")).toBe("$2,500");
  });

  it("edits a bill's name and amount and keeps it marked paid", () => {
    const doc = openTool();
    el(doc, "tplName").value = "Rnet";
    el(doc, "tplAmt").value = "900";
    el(doc, "tplDay").value = "1";
    fire(doc, doc.getElementById("templateForm")!, "submit");
    const box = doc.querySelector("#billMonthList input[type=checkbox]") as HTMLInputElement;
    box.checked = true;
    fire(doc, box, "change");
    editAndSave(doc, doc.querySelector("#billMonthList [data-action=edit]")!, "Rent", "950");
    expect(text(doc, "statBills")).toBe("$950");
    expect(text(doc, "billMonthList")).toContain("Rent");
    expect((doc.querySelector("#billMonthList input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
  });
});
