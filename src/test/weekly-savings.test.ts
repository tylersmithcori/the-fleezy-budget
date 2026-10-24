import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
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
    beforeParse(window) {
      window.scrollTo = () => {};
    },
  });
  return dom.window.document;
}

function typeBillAmount(doc: Document, amount: string) {
  const amt = doc.getElementById("tplAmt") as HTMLInputElement;
  amt.value = amount;
  amt.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
}

function addBill(doc: Document, name: string, amount: string, day: string) {
  (doc.getElementById("tplName") as HTMLInputElement).value = name;
  typeBillAmount(doc, amount);
  (doc.getElementById("tplDay") as HTMLSelectElement).value = day;
  doc
    .getElementById("templateForm")!
    .dispatchEvent(new doc.defaultView.Event("submit", { bubbles: true, cancelable: true }));
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

    const wkBox = doc.getElementById("wkBox")!;
    expect(wkBox.hasAttribute("hidden")).toBe(false);
    expect(doc.getElementById("wkTotal")!.textContent).toContain("$85");
    expect(doc.getElementById("billsTotalLine")!.textContent).toContain("save $85 a week");
  });
});
