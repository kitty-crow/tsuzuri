import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { 文章を装ふ, 原稿を読む } from "../例/物語.tsx";

describe("白萩の露と後日譚", () => {
    test("全篇が一つの Markdown 原稿に収められている", async () => {
        const 原稿 = await readFile("例/白萩の露.md", "utf8");
        const 字句 = 原稿を読む(原稿);
        const 見出し = 字句.filter((項目) => 項目.type === "heading");
        expect(見出し.filter((項目) => 項目.depth === 1).map((項目) => 項目.text)).toEqual(["白萩の露"]);
        expect(見出し.filter((項目) => 項目.depth === 2).map((項目) => 項目.text)).toEqual(["白萩の露　後日譚"]);
        expect(見出し.filter((項目) => 項目.depth === 3).map((項目) => 項目.text)).toEqual([
            "1809-12-22", "1811-05-24", "1813-10-06", "1814-05-09",
            "1814-10-10", "1814-10-21", "1814-11-26",
            "1814-11-27", "1814-12-09", "1815-04-15",
        ]);
        expect(字句.filter((項目) => 項目.type === "blockquote").length).toBeGreaterThanOrEqual(7);
        expect(JSON.stringify(字句)).toContain('"type":"strong"');
        expect(JSON.stringify(字句)).toContain('"type":"em"');
        expect(原稿).toContain("胸が張り裂けそうなので、もう一つの結末を。");
        expect(原稿).toContain("白萩の露　終");
    });
    test("人名の読みはすべての登場箇所に付く", () => {
        const 使用済み = new Set<string>();
        const 要素 = 文章を装ふ("清七と初音　久兵衛と清七", 使用済み);
        expect(JSON.stringify(要素)).toContain("せいしち");
        expect(JSON.stringify(要素)).toContain("はつね");
        expect(JSON.stringify(要素)).toContain("きゅうべえ");
    });
    test("合成字形は最初の一回だけ表示する", () => {
        const 使用済み = new Set<string>();
        const 初回 = 文章を装ふ("白萩", 使用済み);
        const 次回 = 文章を装ふ("白萩", 使用済み);
        expect(JSON.stringify(初回)).toContain("⿱白萩");
        expect(JSON.stringify(次回)).not.toContain("⿱白萩");
        expect(JSON.stringify(次回)).toContain("白萩");
    });
});
