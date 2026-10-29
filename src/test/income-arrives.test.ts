import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM, type DOMWindow } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(path.resolve(process.cwd(), "public/budget.html"), "utf8");
function openTool() {
  const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w: DOMWindow) { w.scrollTo = () => {}; } });
  return dom.window.document;
}
type EventCtor = new (type: string, init?: { bubbles?: boolean }) => unknown;
function fire(doc: Document, node: Element, type: string) {
  const view = doc.defaultView as unknown as { Event: EventCtor };
  node.dispatchEvent(new view.Event(type, { bubbles: true }) as Event);
}
const el = (d: Document, id: string) => d.getElementById(id) as HTMLInputElement;
const text = (d: Document, id: string) => d.getElementById(id)!.textContent!;

describe("Income as it arrives", () => {
  it("each $500 check adds on its own, not as a month lump sum", () => {
    const doc = openTool();
    el(doc, "rcName").value = "Paycheck"; el(doc, "rcAmt").value = "500";
    fire(doc, doc.getElementById("recvForm")!, "submit");
    expect(text(doc, "statIncome")).toBe("$500");
    el(doc, "rcName").value = "Paycheck"; el(doc, "rcAmt").value = "500";
    fire(doc, doc.getElementById("recvForm")!, "submit");
    expect(text(doc, "statIncome")).toBe("$1,000");
  });
  it("weekly check-in records and confirms this week's income", () => {
    const doc = openTool();
    el(doc, "ciAmt").value = "450";
    fire(doc, doc.getElementById("checkinForm")!, "submit");
    expect(text(doc, "checkinText")).toContain("$450");
    el(doc, "ciAmt").value = "480";
    fire(doc, doc.getElementById("checkinForm")!, "submit");
    expect(text(doc, "statIncome")).toBe("$480");
  });
});
