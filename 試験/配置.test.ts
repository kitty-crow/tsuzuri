import { describe, expect, test } from "bun:test";
import { inferGroups, inferZones } from "../src/読取/arrange.ts";
import { makePlans } from "../src/読取/layout.ts";
import { infer } from "../src/読取/infer.ts";
import { japaneseShare, tokenise } from "../src/読取/tokens.ts";
import type { PageGraph, Region } from "../src/読取/types.ts";

function region(id: number, tag: string, text: string, parent: number | null, x: number, y: number, width: number, height: number, links = 0): Region {
    const tokens = tokenise(text);
    return {
        id, parent, tag, text, tokens, japanese: japaneseShare(tokens), links,
        role: "", lang: "ja", protected: false, heading: tag === "h1" ? 1 : 0,
        x, y, width, height, display: "block", position: "static", writingMode: "horizontal-tb",
        fontSize: 18, fontFamily: "serif", fontWeight: "400", colour: "#222", background: "transparent",
    };
}

const graph: PageGraph = {
    width: 1000, height: 800,
    regions: [
        region(0, "body", "ページの案内", null, 0, 0, 1000, 1100),
        region(1, "div", "", 0, 0, 0, 1000, 70),
        region(2, "main", "", 0, 0, 120, 1000, 700),
        region(3, "article", "", 2, 0, 120, 720, 700),
        region(4, "h1", "白萩の庭", 3, 0, 120, 720, 55),
        region(5, "p", "庭の向こうに海が見えた。二人は静かに文章を読み、長い午後を過ごした。", 3, 0, 190, 720, 400),
        region(6, "aside", "関連する作品はこちら", 2, 750, 120, 250, 450, 0.5),
        region(7, "div", "", 0, 0, 950, 1000, 150),
        region(8, "div", "運営情報と利用案内", 7, 0, 955, 400, 50, 1),
        region(9, "img", "", 1, 20, 10, 20, 20),
    ],
    edges: [],
};

describe("ページ全体の配置推定", () => {
    test("要素名に依存せず、下部の情報群をフッターとして認識する", () => {
        const results = infer(graph, new Map(), []);
        const zones = inferZones(graph, results);
        expect(zones.get(7)).toBe("footer");
        expect(zones.get(8)).toBe("footer");
        expect(zones.get(3)).toBe("primary");
        const plans = makePlans(graph, results);
        expect(plans[0]?.mode).toBe("horizontal");
        expect(plans[4]?.mode).toBe("vertical");
        expect(plans[5]?.mode).toBe("vertical");
        expect(plans[8]?.mode).toBe("horizontal");
    });
    test("本文の流れと主従の列を別々の構造として組み直す", () => {
        const results = infer(graph, new Map(), []);
        const plans = makePlans(graph, results);
        const groups = inferGroups(graph, new Map(plans.map((plan) => [plan.id, plan.mode])), new Map(plans.map((plan) => [plan.id, plan.zone ?? "ordinary"])));
        expect(groups.get(3)).toBe("flow");
        expect(groups.get(2)).toBeUndefined();
        expect(groups.has(7)).toBe(false);
    });
    test("ページ末尾の普通の長文をフッターと誤認しない", () => {
        const modified: PageGraph = { ...graph, regions: graph.regions.map((item) =>
            item.id === 8 ? { ...item, text: "物語の最後の章。".repeat(40), links: 0 } : item) };
        const zones = inferZones(modified, infer(modified, new Map(), []));
        expect(zones.get(7)).not.toBe("footer");
    });
});
