import { tokenise } from "./tokens.ts";
import type { Inference, PageGraph, Plan } from "./types.ts";

export const READER_CSS = `
html { overflow-x: hidden; }
body { margin: 0; padding: clamp(12px, 3vw, 40px); line-height: 1.85; }
*, *::before, *::after { box-sizing: border-box; }
[data-tsuzuri-source] { position: static !important; float: none !important; transform: none !important; }
[data-reader-flow] { display: flex !important; flex-direction: row-reverse !important; align-items: flex-start; gap: 1.2em; overflow: auto; max-width: 100%; padding: .5em; }
[data-reader-flow] > * { flex: 0 0 auto; max-width: 100%; }
[data-reader-grid] { display: grid; grid-template-columns: var(--reader-columns); gap: 1.5em; }
[data-reader-grid] > * { min-width: 0; }
[data-reader-vertical] { writing-mode: vertical-rl !important; text-orientation: mixed; display: block !important; inline-size: var(--reader-height); max-inline-size: var(--reader-height); block-size: auto; max-width: none; margin: 0 .4em; overflow: visible; line-height: 1.85; line-break: strict; word-break: normal; }
[data-reader-role="heading"][data-reader-vertical] { inline-size: auto; max-inline-size: var(--reader-height); }
[data-reader-horizontal] { writing-mode: horizontal-tb !important; max-width: 100%; overflow: auto; }
img, video { max-width: min(100%, 36rem); max-height: 65vh; object-fit: contain; }
pre, table { max-width: 100%; overflow: auto; }
a { overflow-wrap: anywhere; }
nav { display: flex; flex-wrap: wrap; gap: 1em; }
ruby { ruby-position: over; } rt { font-size: .5em; }
.綴り-縦中横 { text-combine-upright: all; white-space: nowrap; }
`;

export function makePlans(graph: PageGraph, inference: readonly Inference[]): Plan[] {
    const roles = new Map(inference.map((result) => [result.id, result]));
    const byID = new Map(graph.regions.map((region) => [region.id, region]));
    return graph.regions.map((region) => {
        const result = roles.get(region.id)!;
        let parent = region.parent;
        let protectedAncestor = false;
        while (parent !== null) {
            const ancestor = byID.get(parent);
            const ancestorRole = roles.get(parent)?.role;
            protectedAncestor ||= Boolean(ancestor?.protected || ancestor?.tag === "nav" || ancestor?.role === "navigation"
                || ancestorRole === "interface" || ancestorRole === "code" || ancestorRole === "data");
            parent = ancestor?.parent ?? null;
        }
        const readable = result.scores.prose + result.scores.heading + result.scores.caption;
        const otherLanguage = region.lang.startsWith("zh") || region.lang.startsWith("ko");
        const vertical = region.text.trim().length > 0 && region.japanese > 0.2 && readable > 0.58
            && !region.protected && !protectedAncestor && !otherLanguage && region.width > 0 && region.height > 0;
        return { id: region.id, role: result.role, confidence: result.confidence, mode: vertical ? "vertical" : "horizontal" };
    });
}

function combineNumbers(element: Element, doc: Document): void {
    const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest("ruby, pre, code, .綴り-縦中横")) continue;
        const horizontal = parent.closest("[data-reader-horizontal]");
        if (horizontal && element.contains(horizontal)) continue;
        nodes.push(node as Text);
    }
    for (const node of nodes) {
        const tokens = tokenise(node.data);
        if (!tokens.some((token) => token.kind === "number" && token.text.length <= 2)) continue;
        const fragment = doc.createDocumentFragment();
        for (const token of tokens) {
            if (token.kind !== "number" || token.text.length > 2) { fragment.append(doc.createTextNode(token.text)); continue; }
            const span = doc.createElement("span"); span.className = "綴り-縦中横"; span.textContent = token.text; fragment.append(span);
        }
        node.replaceWith(fragment);
    }
}

/** Preserve the semantic tree and inline markup. Layout is emitted from the IR. */
export function emitLayout(doc: Document, graph: PageGraph, plans: readonly Plan[]): void {
    for (const style of Array.from(doc.querySelectorAll("style, link[rel='stylesheet']"))) style.remove();
    const before = doc.body.textContent;
    const elements = new Map(Array.from(doc.querySelectorAll<HTMLElement>("[data-tsuzuri-source]"), (element) => [Number(element.dataset.tsuzuriSource), element]));
    const regions = new Map(graph.regions.map((region) => [region.id, region]));
    for (const element of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) element.removeAttribute("style");
    doc.body.removeAttribute("style");
    for (const plan of plans) {
        const element = elements.get(plan.id);
        const region = regions.get(plan.id);
        if (!element || !region) continue;
        element.dataset.readerRole = plan.role;
        element.style.fontSize = String(Math.min(56, Math.max(12, region.fontSize))) + "px";
        element.style.fontWeight = region.fontWeight;
        element.style.fontFamily = region.fontFamily;
        element.style.color = region.colour;
        element.style.backgroundColor = region.background;
        if (region.display === "none" || region.width === 0 || region.height === 0) element.hidden = true;
        if (plan.mode === "horizontal") element.dataset.readerHorizontal = "";
        if (plan.mode !== "vertical") continue;
        element.dataset.readerVertical = "";
        element.classList.add("綴り-本文", "綴り-縦書", "綴り-組版");
        // Horizontal ancestors do not prevent an explicit vertical block.
        element.removeAttribute("data-reader-horizontal");
        combineNumbers(element, doc);
    }
    const children = new Map<number, number[]>();
    for (const region of graph.regions) {
        if (region.parent === null) continue;
        const group = children.get(region.parent) ?? []; group.push(region.id); children.set(region.parent, group);
    }
    const vertical = new Set(plans.filter((plan) => plan.mode === "vertical").map((plan) => plan.id));
    for (const [parent, ids] of children) {
        const element = elements.get(parent);
        const hasVertical = ids.some((id) => vertical.has(id));
        if (!element || !hasVertical || element === doc.body) continue;
        element.dataset.readerFlow = "";
    }
    for (const [parent, ids] of children) {
        const element = elements.get(parent);
        const region = regions.get(parent);
        if (!element || !region || element.hasAttribute("data-reader-flow") || ids.length < 2) continue;
        const columns = ids.map((id) => regions.get(id)!).filter((child) => child.width > 0 && child.height > 0);
        const aligned = columns.length >= 2 && columns.every((child) => Math.abs(child.y - columns[0]!.y) < 8);
        if (!aligned || (region.display !== "grid" && region.display !== "flex")) continue;
        element.dataset.readerGrid = "";
        element.style.setProperty("--reader-columns", graph.width < 700 ? "minmax(0, 1fr)" : columns.map((child) => "minmax(0, " + String(child.width / Math.max(1, region.width)) + "fr)").join(" "));
    }
    const style = doc.createElement("style"); style.textContent = READER_CSS; style.dataset.readerStyle = ""; doc.head.append(style);
    if (doc.body.textContent !== before) throw new Error("組版中に本文が変わったため中断しました。");
}

function cost(doc: Document): number {
    const view = doc.defaultView;
    if (!view) return Infinity;
    const groups = Array.from(doc.querySelectorAll<HTMLElement>("[data-reader-flow]"));
    let result = 0;
    for (const group of groups) {
        const children = Array.from(group.children).filter((element) => !element.hasAttribute("hidden"));
        const box = group.getBoundingClientRect();
        result += Math.max(0, group.scrollWidth - group.clientWidth) / Math.max(1, group.clientWidth) * 0.2;
        for (let index = 1; index < children.length; index++) {
            const a = children[index - 1]!.getBoundingClientRect();
            const b = children[index]!.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            result += overlapX * overlapY / Math.max(1, box.width * box.height) * 10;
        }
    }
    result += Math.max(0, doc.documentElement.scrollWidth - view.innerWidth) / Math.max(1, view.innerWidth) * 5;
    for (const element of Array.from(doc.querySelectorAll<HTMLElement>("[data-reader-vertical]"))) {
        result += Math.max(0, element.scrollHeight - element.clientHeight - 2) / Math.max(1, element.clientHeight);
    }
    return result;
}

/** Bounded global search uses actual browser measurements, followed by local repair. */
export function optimise(doc: Document, graph: PageGraph, plans: readonly Plan[]): Plan[] {
    const candidates = [0.62, 0.74, 0.84].map((fraction) => Math.max(120, Math.min(720, graph.height * fraction)));
    let best = candidates[0]!;
    let minimum = Infinity;
    for (const height of candidates) {
        doc.documentElement.style.setProperty("--reader-height", String(height) + "px");
        const value = cost(doc) + Math.abs(height / graph.height - 0.74) * 0.05;
        if (value < minimum) { minimum = value; best = height; }
    }
    doc.documentElement.style.setProperty("--reader-height", String(best) + "px");
    const revised = plans.map((plan): Plan => {
        const element = doc.querySelector<HTMLElement>('[data-tsuzuri-source="' + String(plan.id) + '"]');
        if (!element || plan.mode !== "vertical") return plan;
        const broken = element.scrollHeight > element.clientHeight + 4;
        if (!broken) return plan;
        element.removeAttribute("data-reader-vertical"); element.dataset.readerHorizontal = "";
        element.classList.remove("綴り-縦書");
        return { ...plan, mode: "horizontal" };
    });
    return revised;
}
