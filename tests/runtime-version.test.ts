import { expect, test } from "bun:test";
import { versionUrls } from "../src/run/version.ts";

test("falls back to the current document root when the configured Pages base is stale", () => {
  const urls = versionUrls(
    "/old-project/",
    "version.json",
    "https://app.example.test",
    "https://app.example.test/new-project/"
  );

  expect(urls.map(url => url.href)).toEqual([
    "https://app.example.test/old-project/version.json",
    "https://app.example.test/new-project/version.json"
  ]);
});

test("does not request the same version URL twice", () => {
  const urls = versionUrls(
    "/project/",
    "version.json",
    "https://app.example.test",
    "https://app.example.test/project/"
  );

  expect(urls.map(url => url.href)).toEqual([
    "https://app.example.test/project/version.json"
  ]);
});
