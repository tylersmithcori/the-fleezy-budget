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

function addIncome(doc: Document, name: string, amt: string, freq: "week" | "month") {
  el(doc, "incName").value = name;
  el(doc, "incFreq").value = freq;
  el(doc, "incAmt").value = amt;
  fire(doc, doc.getElementById("incomeForm")!, "submit");
}
function setSave(doc: Document, v: string) {
  el(doc, "saveVal").value = v;
  fire(doc, el(doc, "saveVal"), "input");
}
function addBill(doc: Document, name: string, amt: string, day: string) {
  el(doc, "tplName").value = name;
  el(doc, "tplAmt").value = amt;
  el(doc, "tplDay").value = day;
  fire(doc, doc.getElementById("templateForm")!, "submit");
}

describe("Weekly pay planning", () => {
  it("$500 a week adds up to $2,000 a month from 4 checks", () => {
    const doc = openTool();
    addIncome(doc, "Job", "500", "week");
    expect(text(doc, "statIncome")).toBe("$2,000");
    expect(text(doc, "incomeList")).toContain("$500/wk");
  });

  it("takes the savings percent from each $500 check", () => {
    const doc = openTool();
    addIncome(doc, "Job", "500", "week");
    setSave(doc, "10");
    expect(text(doc, "saveText")).toContain("From each $500 Job check: $50 to savings");
    expect(text(doc, "saveText")).toContain("$200 a month");
  });
});

describe("Weekly savings (optional) and smart set-aside", () => {
  it("weekly savings = monthly savings ÷ 4 when using a percent", () => {
    const doc = openTool();
    addIncome(doc, "Job", "2400", "month");
    setSave(doc, "10");
    expect(text(doc, "saveText")).toContain("$240 a month");
    expect(text(doc, "saveText")).toContain("$60 a week");
  });

  it("hides weekly savings when the user turns it off", () => {
    const doc = openTool();
    addIncome(doc, "Job", "2400", "month");
    setSave(doc, "10");
    const box = el(doc, "showWeekly");
    box.checked = false;
    fire(doc, box, "change");
    expect(text(doc, "saveText")).not.toContain("a week");
    expect(doc.getElementById("wkSmart")!.hidden).toBe(true);
  });

  it("smart set-aside = weekly savings + weekly bills", () => {
    const doc = openTool();
    addIncome(doc, "Job", "2400", "month");
    setSave(doc, "10");
    addBill(doc, "Rent", "240", "1");
    expect(text(doc, "wkSmart")).toContain("$120");
  });
});
