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
    test("元号と新暦", () => {
        expect(日付を整える("2026-10-28", false)).toBe("令和八年十月二十八日");
    });
    test("照合済み旧暦の日付", () => {
        expect(日付を整える("2026-10-11", true)).toBe("令和八年長月一日");
        expect(日付を整える("2026-10-28", true)).toBe("令和八年長月十八日");
        expect(日付を整える("2026-11-09", true)).toBe("令和八年神無月一日");
    });
    test("未対応と不正な日付を推測しない", () => {
        expect(日付を整える("2025-10-28", true)).toBeNull();
        expect(日付を整える("2026-02-30", false)).toBeNull();
    });
});

