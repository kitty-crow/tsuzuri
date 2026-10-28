import { describe, expect, test } from "bun:test";
import { 漢数字へ } from "../src/漢数字.ts";
import { 日付を整える } from "../src/暦.ts";

describe("漢数字", () => {
    test("位取り", () => {
        expect(漢数字へ(18)).toBe("十八");
        expect(漢数字へ(2026)).toBe("二千二十六");
        expect(漢数字へ(1001)).toBe("千一");
        expect(漢数字へ(0)).toBe("〇");
    });
    test("各桁と大字", () => {
        expect(漢数字へ(2026, "各桁")).toBe("二〇二六");
        expect(漢数字へ(18, "大字")).toBe("拾捌");
        expect(漢数字へ(-1)).toBe("");
    });
});

describe("暦", () => {
    test("新暦の元号", () => {
        expect(日付を整える("2026-10-28", false)).toBe("令和八年十月二十八日");
    });
    test("現代の照合済み旧暦", () => {
        expect(日付を整える("2026-10-11", true)).toBe("令和八年長月一日");
        expect(日付を整える("2026-10-28", true)).toBe("令和八年長月十八日");
        expect(日付を整える("2026-11-09", true)).toBe("令和八年神無月一日");
    });
    test("江戸時代の寛政暦と干支", () => {
        expect(日付を整える("1809-12-22", true, { 干支: true })).toBe("文化六年己巳　霜月十六日");
        expect(日付を整える("1811-05-24", true, { 干支: true })).toBe("文化八年辛未　卯月三日");
        expect(日付を整える("1813-10-06", true, { 干支: true })).toBe("文化十年癸酉　長月十三日");
        expect(日付を整える("1814-05-09", true, { 干支: true })).toBe("文化十一年甲戌　弥生二十日");
        expect(日付を整える("1814-10-10", true, { 年表示: "同年", 廿: true })).toBe("同年　葉月廿七日");
        expect(日付を整える("1814-10-21", true, { 年表示: "同年" })).toBe("同年　長月九日");
        expect(日付を整える("1814-11-26", true, { 年表示: "同年" })).toBe("同年　神無月十五日");
        expect(日付を整える("1814-11-27", true, { 干支: true })).toBe("文化十一年甲戌　神無月十六日");
        expect(日付を整える("1814-12-09", true, { 年表示: "同年", 廿: true })).toBe("同年　神無月廿八日");
        expect(日付を整える("1815-04-15", true, { 干支: true, 吉日: true })).toBe("文化十二年乙亥　弥生吉日");
    });
    test("暦月の末日と未照合の日付を区別する", () => {
        expect(日付を整える("1814-10-12", true)).toBe("文化十一年葉月二十九日");
        expect(日付を整える("1814-10-13", true)).toBe("文化十一年長月一日");
        expect(日付を整える("1809-12-06", true)).toBeNull();
        expect(日付を整える("1814-01-01", true)).toBeNull();
        expect(日付を整える("2025-10-28", true)).toBeNull();
        expect(日付を整える("2026-02-30", false)).toBeNull();
    });
});
