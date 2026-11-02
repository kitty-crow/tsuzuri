import { japaneseShare, tokenise } from "./tokens.ts";
import type { Edge, PageGraph, Region } from "./types.ts";

const protectedSelector = "pre, code, table, form, input, select, textarea, button, canvas, svg, video, audio, [role='application'], [role='grid'], [role='textbox'], [role='button'], [role='combobox'], [role='slider'], [role='switch'], [role='checkbox'], [role='radio'], [role='listbox'], [role='tablist'], [role='menubar'], [role='tree']";
const skipped = "script, style, template, rt, rp, [hidden], [aria-hidden='true']";
const inlineDisplays = new Set(["inline", "inline-block", "inline-flex", "inline-grid", "contents", "ruby", "ruby-base", "ruby-text"]);

export function observePage(doc: Document, width: number, height: number): PageGraph {
    const view = doc.defaultView;
    if (!view) throw new Error("レイアウトを測定できません。");
    const nodes = Array.from(doc.body.querySelectorAll<HTMLElement>("*")).filter((element) => !element.closest(skipped));
    if (nodes.length > 12000) throw new Error("ページの構造が大きすぎます（上限 12,000 要素）。");
    const blocks = [doc.body, ...nodes].filter((element) => {
        const style = view.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return true;
        return element === doc.body || !inlineDisplays.has(style.display) || element.matches(protectedSelector + ", img, h1, h2, h3, h4, h5, h6");
    });
    const ids = new Map<Element, number>(blocks.map((element, id) => [element, id]));
    const texts = new Map<number, string>();
    const linkTexts = new Map<number, number>();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(skipped)) continue;
        let owner: Element | null = parent;
        while (owner && !ids.has(owner)) owner = owner.parentElement;
        const id = owner ? ids.get(owner) : undefined;
        if (id === undefined) continue;
        const text = node.textContent ?? "";
        texts.set(id, (texts.get(id) ?? "") + text);
        if (parent.closest("a")) linkTexts.set(id, (linkTexts.get(id) ?? 0) + text.length);
    }
    const regions = blocks.map((element, id): Region => {
        element.dataset.tsuzuriSource = String(id);
        const style = view.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const text = texts.get(id) ?? "";
        const tokens = tokenise(text);
        let parent = element.parentElement;
        while (parent && !ids.has(parent)) parent = parent.parentElement;
        return {
            id, parent: parent ? ids.get(parent) ?? null : null,
            tag: element.localName, role: element.getAttribute("role") ?? "", lang: element.closest("[lang]")?.getAttribute("lang") ?? "",
            text, tokens, japanese: japaneseShare(tokens), links: Math.min(1, (linkTexts.get(id) ?? 0) / Math.max(1, text.length)),
            protected: Boolean(element.closest(protectedSelector)),
            heading: ["h1", "h2", "h3", "h4", "h5", "h6"].indexOf(element.localName) + 1,
            x: box.x, y: box.y, width: box.width, height: box.height,
            fontSize: Number.parseFloat(style.fontSize) || 16, fontFamily: style.fontFamily, fontWeight: style.fontWeight,
            colour: style.color, background: style.backgroundColor,
            display: style.visibility === "hidden" || style.visibility === "collapse" ? "none" : style.display,
            writingMode: style.writingMode, position: style.position,
        };
    });
    const edges: Edge[] = [];
    const siblings = new Map<number | null, Region[]>();
    for (const region of regions) {
        if (region.parent !== null) edges.push({ from: region.parent, to: region.id, kind: "contains", weight: 0.7 });
        const group = siblings.get(region.parent) ?? [];
        const previous = group.at(-1);
        if (previous) edges.push({ from: previous.id, to: region.id, kind: "sequence", weight: 0.4 });
        if (previous && Math.abs(previous.x - region.x) < 3 && Math.abs(previous.width - region.width) < 3) edges.push({ from: previous.id, to: region.id, kind: "alignment", weight: 0.6 });
        group.push(region); siblings.set(region.parent, group);
    }
    // Explicit accessibility associations are stronger than geometric proximity.
    for (const element of blocks) {
        const source = ids.get(element)!;
        const labels = (element.getAttribute("aria-labelledby") ?? "").split(" ").filter(Boolean);
        const targetID = element.getAttribute("for");
        if (targetID) labels.push(targetID);
        for (const label of labels) {
            let target = doc.getElementById(label);
            while (target && !ids.has(target)) target = target.parentElement;
            const destination = target ? ids.get(target) : undefined;
            if (destination !== undefined && destination !== source) edges.push({ from: source, to: destination, kind: "label", weight: 0.9 });
        }
    }
    // A bounded spatial sweep connects nearby regions across DOM wrapper boundaries.
    const spatial = regions.filter((region) => region.width > 0 && region.height > 0 && region.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    for (let index = 0; index < spatial.length; index++) {
        const region = spatial[index]!;
        for (const other of spatial.slice(index + 1, index + 9)) {
            const dx = Math.max(0, Math.max(region.x, other.x) - Math.min(region.x + region.width, other.x + other.width));
            const dy = Math.max(0, Math.max(region.y, other.y) - Math.min(region.y + region.height, other.y + other.height));
            const distance = Math.hypot(dx, dy) / Math.max(1, region.fontSize + other.fontSize);
            if (distance < 3 && region.parent !== other.parent) edges.push({ from: region.id, to: other.id, kind: "nearby", weight: 0.3 / (1 + distance) });
        }
    }
    return { regions, edges, width, height };
}
