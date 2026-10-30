import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM, type DOMWindow } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(path.resolve(process.cwd(), "public/budget.html"), "utf8");

function openTool(saved?: object) {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window: DOMWindow) {
      window.scrollTo = () => {};
      if (saved) {
        for (let i = 0; i < 1; i++) {
          // seed under every key the page might read
        }
        (window as unknown as { __seed: object }).__seed = saved;
      }
    },
  });
  return dom.window.document;
}

describe("browser notification option", () => {
  it("is off by default for a new visitor", () => {
    const doc = openTool();
    const box = doc.getElementById("remNotifyOn") as HTMLInputElement;
    expect(box).not.toBeNull();
    expect(box.checked).toBe(false);
  });
});
