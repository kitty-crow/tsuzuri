import { describe, expect, test } from "bun:test";
import { cacheKey, readQuery, sourceURL } from "../src/読取/query.ts";
import { japaneseShare, tokenise } from "../src/読取/tokens.ts";
import { infer } from "../src/読取/infer.ts";
import { makePlans } from "../src/読取/layout.ts";
import type { PageGraph, Region } from "../src/読取/types.ts";

function region(id: number, text: string, tag: string, extra: Partial<Region> = {}): Region {
    const tokens = tokenise(text);
    return {
        id, text, tag, tokens, japanese: japaneseShare(tokens), parent: null, role: "", lang: "ja", links: 0,
        protected: false, heading: 0, x: 0, y: 0, width: 600, height: 200, fontSize: 16,
        fontFamily: "serif", fontWeight: "400", colour: "rgb(0, 0, 0)", background: "transparent",
        display: "block", writingMode: "horizontal-tb", position: "static", ...extra,
    };
}

describe("読書対象のURLと保存キー", () => {
    test("日本語・引用符・クエリーを含むURLを読み取る", () => {
        const url = new URL("https://example.jp/物語?q=白萩&sort=asc#第二章");
        expect(readQuery("?w=" + encodeURIComponent('"' + url.href + '"'))?.href).toBe(url.href);
        expect(readQuery("?other=1")).toBeNull();
        expect(() => readQuery("?w=")).toThrow();
        expect(() => readQuery("?w=https://example.jp&w=https://other.jp")).toThrow();
    });
    test.each(["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "https://u:p@example.jp", "http://127.0.0.1", "http://2130706433", "http://10.1.2.3", "http://172.16.0.1", "http://192.168.0.2", "http://[::1]", "http://host.local", "http://localhost"])("対象外のURLを拒否する: %s", (url) => expect(() => sourceURL(url)).toThrow());
    test("保存キーにクエリーと表示寸法を含め、フラグメントを除く", () => {
        const a = sourceURL("https://example.jp/article?a=1#first");
        const b = sourceURL("https://example.jp/article?a=1#second");
        expect(cacheKey(a, 800, 600)).toBe(cacheKey(b, 800, 600));
        expect(cacheKey(a, 800, 600)).not.toBe(cacheKey(a, 801, 600));
        expect(cacheKey(a, 800, 600)).not.toBe(cacheKey(sourceURL("https://example.jp/article?a=2"), 800, 600));
    });
});

describe("日本語の分割と原文の保持", () => {
    test.each(["2026年11月2日に、OpenAIのAPIを使いました。", "𠮷野家と👩‍👩‍👧の物語。", "か\u3099 １２ 日本語", "", "漢字<ruby>😻\nword"])("原文中の位置と全文を保つ: %s", (text) => {
        const tokens = tokenise(text);
        expect(tokens.map((token) => token.text).join("")).toBe(text);
        for (const token of tokens) expect(text.slice(token.start, token.end)).toBe(token.text);
    });
    test("絵文字の書記素と補助漢字を分断しない", () => {
        const tokens = tokenise("𠮷👩‍👩‍👧12API");
        expect(tokens.some((token) => token.text === "𠮷" && token.kind === "japanese")).toBe(true);
        expect(tokens.some((token) => token.text === "👩‍👩‍👧")).toBe(true);
        expect(tokens.some((token) => token.text === "12" && token.kind === "number")).toBe(true);
    });
});

describe("構造に基づく配置の推定", () => {
    const graph: PageGraph = {
        width: 900, height: 700,
        regions: [region(0, "", "article"), region(1, "白萩の露", "h1", { parent: 0, heading: 1, fontSize: 32 }),
            region(2, "秋の夜に、二人は長い物語を読みました。言葉は静かに流れていきます。", "p", { parent: 0 }),
            region(3, "関連する記事", "nav", { links: 1 }), region(4, "記事を読む", "p", { parent: 3 }),
            region(5, "const 日本語 = 1", "pre", { protected: true }), region(6, "売上 一万円", "table", { protected: true })],
        edges: [{ from: 0, to: 1, kind: "contains", weight: 0.7 }, { from: 0, to: 2, kind: "contains", weight: 0.7 }, { from: 1, to: 2, kind: "sequence", weight: 0.4 }, { from: 3, to: 4, kind: "contains", weight: 0.7 }],
    };
    test("階層と関連付けから推定し、操作部と表を横書きに保つ", () => {
        const results = infer(graph, new Map(), []);
        const plans = makePlans(graph, results);
        expect(plans[1]?.mode).toBe("vertical");
        expect(plans[2]?.mode).toBe("vertical");
        expect(plans[4]?.mode).toBe("horizontal");
        expect(plans[5]?.mode).toBe("horizontal");
        expect(plans[6]?.mode).toBe("horizontal");
        for (const result of results) expect(Object.values(result.scores).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        expect(infer(graph, new Map(), [])).toEqual(results);
    });
    test("意味ベクトルに応じて曖昧な領域を分類する", () => {
        const ambiguous: PageGraph = { width: 900, height: 700, regions: [region(0, "日本語を読むための文章です。", "div")], edges: [] };
        const anchors = [[1, 0], [0, 1], [-1, 0], [0, -1], [-1, 0], [0, -1], [-1, 0]];
        expect(infer(ambiguous, new Map([[0, [1, 0]]]), anchors)[0]?.role).toBe("prose");
        expect(infer(ambiguous, new Map([[0, [0, 1]]]), anchors)[0]?.role).toBe("heading");
    });
});
