import { ROLES, type Inference, type PageGraph, type Role, type Scores } from "./types.ts";

/** Multilingual semantic anchors are encoded by the same non-generative model as page text. */
export const ANCHORS: Readonly<Record<Role, string>> = {
    prose: "物語、記事の本文、説明文。読者が続けて読む文章。 An article, story or explanatory passage.",
    heading: "記事の題名、章の見出し、節のタイトル。 A title or section heading.",
    navigation: "目次、メニュー、関連記事へのリンク、サイト内の案内。 Navigation menu and related links.",
    caption: "写真の説明、図の注記、出典。 A caption describing an image or illustration.",
    interface: "検索、購入、ログイン、設定、操作するボタン。 Interactive controls, search, settings and purchase.",
    code: "プログラムのソースコード、コマンド、技術的な構文。 Source code or a command line.",
    data: "表、数値、価格、比較するデータの一覧。 A table of figures or structured data.",
};

const semantics: Readonly<Record<string, Role>> = {
    p: "prose", article: "prose", blockquote: "prose", main: "prose",
    h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
    heading: "heading", nav: "navigation", navigation: "navigation",
    figcaption: "caption", caption: "caption", button: "interface", input: "interface", form: "interface",
    search: "interface", textbox: "interface", pre: "code", code: "code", table: "data", grid: "data",
};

function scores(make: (role: Role) => number): Scores {
    return Object.fromEntries(ROLES.map((role) => [role, make(role)])) as Scores;
}

export function normalise(logits: Scores): Scores {
    const maximum = Math.max(...Object.values(logits));
    const exp = scores((role) => Math.exp(logits[role] - maximum));
    const total = Object.values(exp).reduce((a, b) => a + b, 0);
    return scores((role) => exp[role] / total);
}

function cosine(a: readonly number[], b: readonly number[]): number {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function compatibility(a: Role, b: Role, containment: boolean): number {
    if (a === b) return 1;
    if (containment && a === "prose" && (b === "heading" || b === "caption")) return 0.5;
    if (a === "heading" && b === "prose") return 0.65;
    if (a === "prose" && b === "caption") return 0.4;
    return 0;
}

/** Synchronous damped graph inference. Scores are evidence strengths, not calibrated probabilities. */
export function infer(graph: PageGraph, vectors: ReadonlyMap<number, readonly number[]>, anchors: readonly (readonly number[])[]): Inference[] {
    const unary = new Map<number, Scores>();
    for (const region of graph.regions) {
        const semantic = semantics[region.role] ?? semantics[region.tag];
        const vector = vectors.get(region.id);
        unary.set(region.id, scores((role) => {
            const anchor = anchors[ROLES.indexOf(role)];
            const learned = vector && anchor ? cosine(vector, anchor) * 5 : 0;
            const declared = semantic === role ? 3.5 : 0;
            const language = role === "prose" ? region.japanese * Math.log1p(region.tokens.length) * 0.28 : 0;
            const links = role === "navigation" ? region.links * 2 : -region.links * 0.3;
            const type = role === "heading" ? Math.log(Math.max(1, region.fontSize / 16)) : 0;
            const density = role === "prose" ? Math.min(1, region.text.length / Math.max(1, region.width * region.height) * 150) : 0;
            return learned + declared + language + links + type + density;
        }));
    }
    let current = new Map(Array.from(unary, ([id, values]) => [id, normalise(values)]));
    const neighbours = new Map<number, { id: number; weight: number; contains: boolean }[]>();
    for (const edge of graph.edges) {
        const forward = neighbours.get(edge.from) ?? [];
        const backward = neighbours.get(edge.to) ?? [];
        forward.push({ id: edge.to, weight: edge.weight, contains: edge.kind === "contains" });
        backward.push({ id: edge.from, weight: edge.weight, contains: edge.kind === "contains" });
        neighbours.set(edge.from, forward); neighbours.set(edge.to, backward);
    }
    for (let iteration = 0; iteration < 6; iteration++) {
        const next = new Map<number, Scores>();
        for (const region of graph.regions) {
            const adjacent = neighbours.get(region.id) ?? [];
            const total = Math.max(1, adjacent.reduce((sum, item) => sum + item.weight, 0));
            const base = unary.get(region.id)!;
            const updated = normalise(scores((role) => base[role] + adjacent.reduce((sum, item) => {
                const values = current.get(item.id)!;
                const agreement = ROLES.reduce((value, other) => value + values[other] * compatibility(role, other, item.contains), 0);
                return sum + item.weight * agreement;
            }, 0) / total));
            const previous = current.get(region.id)!;
            next.set(region.id, scores((role) => previous[role] * 0.35 + updated[role] * 0.65));
        }
        current = next;
    }
    return graph.regions.map((region) => {
        const values = current.get(region.id)!;
        const role = ROLES.reduce((best, candidate) => values[candidate] > values[best] ? candidate : best, "prose");
        const entropy = -Object.values(values).reduce((sum, value) => sum + value * Math.log(Math.max(1e-10, value)), 0);
        return { id: region.id, scores: values, role, confidence: 1 - entropy / Math.log(ROLES.length) };
    });
}
