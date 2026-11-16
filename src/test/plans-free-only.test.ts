import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM, type DOMWindow } from "jsdom";
import { describe, expect, it } from "vitest";

// The tool is a static page served in an iframe, so the test loads the real file
// and reads what the page actually renders.
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
  const doc = dom.window.document;
  // Script and style text is not something a visitor sees on a screen.
  doc.querySelectorAll("script,style").forEach(node => node.remove());
  return doc;
}

describe("Free plan only", () => {
  it("shows one plan card, and it is the Free plan at $0", () => {
    const doc = openTool();
    const cards = [...doc.querySelectorAll(".plan")];
    expect(cards).toHaveLength(1);
    const [free] = cards;
    expect(free?.querySelector("h3")?.textContent).toContain("Free");
    expect(free?.querySelector(".price")?.textContent).toContain("$0");
  });

  it("keeps Plus and Premium wording, prices and upgrade prompts off every screen", () => {
    const text = openTool().body.textContent || "";
    expect(text).not.toMatch(/\bPlus\b/i);
    expect(text).not.toMatch(/\bPremium\b/i);
    expect(text).not.toMatch(/\$2\b/);
    expect(text).not.toMatch(/\$5\b/);
    expect(text).not.toMatch(/upgrade/i);
    expect(text).not.toMatch(/coming later/i);
  });
});
