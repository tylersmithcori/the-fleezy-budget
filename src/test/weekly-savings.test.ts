import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM, type DOMWindow } from "jsdom";
import { describe, expect, it } from "vitest";

// The tool is a static page served in an iframe, so the test loads the real file
// and runs its own script rather than re-implementing the math here.
const html = readFileSync(
  path.resolve(process.cwd(), "public/budget.html"),
  "utf8",
);

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

function typeBillAmount(doc: Document, amount: string) {
  const amt = doc.getElementById("tplAmt") as HTMLInputElement;
  amt.value = amount;
  fire(doc, amt, "input");
}

function addBill(doc: Document, name: string, amount: string, day: string) {
  (doc.getElementById("tplName") as HTMLInputElement).value = name;
  typeBillAmount(doc, amount);
  (doc.getElementById("tplDay") as HTMLSelectElement).value = day;
  fire(doc, doc.getElementById("templateForm")!, "submit");
}

describe("Weekly savings for bills (monthly ÷ 4)", () => {
  it("previews the weekly amount live while typing a new bill amount", () => {
    const doc = openTool();

    typeBillAmount(doc, "240");

    expect(doc.getElementById("tplWkHint")!.textContent).toContain("$60 a week");
  });

  it("shows each bill's weekly amount next to its monthly amount and due day", () => {
    const doc = openTool();

    addBill(doc, "Rent", "240", "1");

    const templateRow = doc.querySelector("#templateList .row")!.textContent!;
    expect(templateRow).toContain("$60/wk");
    expect(templateRow).toContain("$240");

    const monthRow = doc.querySelector("#billMonthList .row")!.textContent!;
    expect(monthRow).toContain("$60/wk");
    expect(monthRow).toContain("$240");
  });

  it("shows the combined weekly total of all bills at the top of the month view", () => {
    const doc = openTool();

    addBill(doc, "Rent", "240", "1");
    addBill(doc, "Phone", "100", "15");

    expect(doc.getElementById("wkBox")!.hasAttribute("hidden")).toBe(false);
    expect(doc.getElementById("wkTotal")!.textContent).toContain("$85");
    expect(doc.getElementById("billsTotalLine")!.textContent).toContain("save $85 a week");
  });
});
