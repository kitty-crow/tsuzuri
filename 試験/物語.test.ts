import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { 文章を装ふ, 原稿を章に分ける } from "../例/物語.tsx";

describe("白萩の露", () => {
    test("原稿は西暦の日付で七つの章を持つ", async () => {
        const 原稿 = await readFile("例/白萩の露.md", "utf8");
        const 章 = 原稿を章に分ける(原稿);
        expect(章.length).toBe(7);
        expect(章.map((内容) => 内容.日付)).toEqual([
            "1809-12-22", "1811-05-24", "1813-10-06", "1814-05-09",
            "1814-10-10", "1814-10-21", "1814-11-26",
        ]);
        expect(章[0]?.段落[0]).toContain("夜霧");
        expect(章[6]?.段落.at(-1)).toBe("**露と消えにし人の名を　花のみぞ知る**");
        expect(章.flatMap((一章) => 一章.字句).filter((字) => 字.type === "blockquote").length).toBeGreaterThanOrEqual(7);
        expect(章.flatMap((一章) => 一章.字句).some((字) => 字.type === "paragraph" && 字.text.includes("**"))).toBe(true);
    });
    test("同じ人名には何度でも同じ読みを付ける", () => {
        const 使用済 = new Set<string>();
        const 要素 = 文章を装ふ("清七と初音　久兵衛と清七", 使用済);
        expect(要素.length).toBeGreaterThan(2);
        expect(JSON.stringify(要素)).toContain("せいしち");
        expect(JSON.stringify(要素)).toContain("はつね");
        expect(JSON.stringify(要素)).toContain("きゅうべえ");
    });
    test("同じ表現を繰り返しても専用の合成文字は一度だけ", () => {
        const 使用済 = new Set<string>();
        const 初回 = 文章を装ふ("白萩", 使用済);
        const 次回 = 文章を装ふ("白萩", 使用済);
        expect(JSON.stringify(初回)).toContain("⿱白萩");
        expect(JSON.stringify(次回)).not.toContain("⿱白萩");
        expect(JSON.stringify(次回)).toContain("白萩");
    });
});
