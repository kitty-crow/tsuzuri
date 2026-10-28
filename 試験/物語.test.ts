import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { 文章を装ふ, 原稿を読む, 見出しか, 目次を組む } from "../例/物語.tsx";
import { marked } from "marked";

describe("白萩の露と後日譚", () => {
    test("全篇が一つの Markdown 原稿に収められている", async () => {
        const 原稿 = await readFile("例/白萩の露.md", "utf8");
        const 字句 = 原稿を読む(原稿);
        const 見出し = 字句.filter(見出しか);
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
        expect(原稿).toContain("松葉屋の主たる海藤を訪ねたり");
        expect(原稿).toContain("松葉屋の海藤を枕元に呼びて");
        expect(原稿).toContain("「海藤さま　あと七両　必ず調へて参ります」");
        expect(原稿).toContain("「海藤さま　約束の金　残らず持参つかまつりました」");
        expect(原稿).toContain("「旦那さま　どうぞわちきを死んだものにしておくんなんし」");
        expect(原稿).toContain("> 清七さま");
        expect(原稿).toContain("「清七さん　もう燈心を撚ることはおやめなんし」");
        expect(原稿).toContain("**「主様　来年も白萩を見せておくんなんし」**");
        expect(原稿).toContain("「初音さま」");
    });
    test("目次を原稿の見出しから自動生成する", async () => {
        const 原稿 = await readFile("例/白萩の露.md", "utf8");
        const 字句 = 原稿を読む(原稿);
        const 目次 = 目次を組む(字句);
        expect(目次.識別表.size).toBe(12);
        expect(目次.節.map((節) => 節.表記)).toEqual(["白萩の露", "白萩の露　後日譚"]);
        expect(目次.節.map((節) => 節.子.length)).toEqual([7, 3]);
        const 識別 = Array.from(目次.識別表.values());
        expect(new Set(識別).size).toBe(識別.length);
        expect(目次.節[0]?.子[0]?.表記).toBe("1809-12-22");
        const 自由な原稿 = marked.lexer("# 題名\n\n### 1900-01-01\n\n## 第二部\n\n### 1901-01-01");
        const 動的 = 目次を組む(自由な原稿);
        expect(動的.節.map((節) => 節.子.map((子) => 子.表記))).toEqual([
            ["1900-01-01"], ["1901-01-01"],
        ]);
    });
    test("人名の読みはすべての登場箇所に付く", () => {
        const 使用済み = new Set<string>();
        const 要素 = 文章を装ふ("清七と初音　久兵衛と海藤　主様と清七", 使用済み);
        expect(JSON.stringify(要素)).toContain("せいしち");
        expect(JSON.stringify(要素)).toContain("はつね");
        expect(JSON.stringify(要素)).toContain("きゅうべえ");
        expect(JSON.stringify(要素)).toContain("かいとう");
        expect(JSON.stringify(要素)).toContain("ぬしさま");
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
