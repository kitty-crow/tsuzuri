import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "../src/html.ts";
import { assertMobileViewport, mobileViewport, mobileViewportTag, setMobileViewport } from "../src/mobile.ts";

const root = join(import.meta.dir, "..");

const htmlFiles = async (directory: string): Promise<readonly string[]> => {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.html");
  for await (const file of glob.scan({ cwd: directory, onlyFiles: true })) files.push(file);
  return files.sort();
};

test("canonical mobile viewport locks scale in both directions", () => {
  expect(mobileViewport).toBe("width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no");
  expect(mobileViewportTag).toBe(`<meta name="viewport" content="${mobileViewport}">`);
});

test("mobile viewport validation rejects missing, stale and duplicate policies", () => {
  expect(() => assertMobileViewport(`<head>${mobileViewportTag}</head>`)).not.toThrow();
  expect(() => assertMobileViewport("<head></head>")).toThrow("exactly one viewport meta tag");
  expect(() => assertMobileViewport('<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>')).toThrow("must use viewport content");
  expect(() => assertMobileViewport(`<head>${mobileViewportTag}${mobileViewportTag}</head>`)).toThrow("exactly one viewport meta tag");
});

test("viewport normalisation replaces stale policy and removes duplicates", () => {
  const stale = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head></html>';
  expect(setMobileViewport(stale)).toContain(mobileViewportTag);

  const duplicated = `<html><head>${mobileViewportTag}${mobileViewportTag}</head></html>`;
  expect(setMobileViewport(duplicated).match(/name="viewport"/g)?.length).toBe(1);
});

test("every example and scaffold HTML source carries the canonical viewport", async () => {
  for (const directory of [join(root, "example", "web"), join(root, "scaffold", "web")]) {
    for (const file of await htmlFiles(directory)) {
      const html = await readFile(join(directory, file), "utf8");
      expect(() => assertMobileViewport(html, file)).not.toThrow();
    }
  }
});

test("generated redirects carry the canonical viewport", () => {
  expect(redirect("/about/")).toContain(mobileViewportTag);
});

test("CI runs a real mobile layout audit instead of masking root overflow", async () => {
  const [audit, workflow, scaffoldCheck, scaffoldPages] = await Promise.all([
    readFile(join(root, "src", "mobileAudit.ts"), "utf8"),
    readFile(join(root, ".github", "workflows", "check.yml"), "utf8"),
    readFile(join(root, "scaffold", ".github", "workflows", "check.yml"), "utf8"),
    readFile(join(root, "scaffold", ".github", "workflows", "pages.yml"), "utf8")
  ]);

  expect(audit).toContain("320, height: 568");
  expect(audit).toContain("430, height: 932");
  expect(audit).toContain("portrait-after-rotation");
  expect(audit).toContain("documentWidth > result.viewport + 1");
  expect(audit).toContain('overflow === "hidden" || overflow === "clip"');
  expect(audit).toContain('position === "fixed"');
  expect(audit).toContain("Likely offenders:");

  expect(workflow).toContain("pull_request:");
  expect(workflow).toContain("playwright install --with-deps chromium");
  expect(workflow).toContain("example:audit-mobile");
  expect(scaffoldCheck).toContain("pull_request:");
  expect(scaffoldCheck).toContain("audit-mobile site");
  expect(scaffoldPages).toContain("audit-mobile site");
});
