import { inferGroups, inferZones } from "./arrange.ts";
import { tokenise } from "./tokens.ts";
import type { Inference, PageGraph, Plan, Region } from "./types.ts";

export const READER_CSS = "\nhtml { max-inline-size: 100%; overflow-x: auto; }\nbody[data-reader-page] { max-width: 100%; writing-mode: horizontal-tb !important; }\n[data-reader-landmark=\"header\"], [data-reader-landmark=\"footer\"] {\n  position: static !important; inset: auto !important; transform: none !important; clear: both; height: auto !important; max-height: none !important;\n  max-width: 100%; box-sizing: border-box; writing-mode: horizontal-tb !important;\n}\n[data-reader-landmark=\"footer\"] { grid-column: 1 / -1 !important; width: 100%; }\n[data-reader-flow] {\n  display: flex !important; flex-direction: row-reverse !important; align-items: flex-start !important;\n  flex-wrap: nowrap !important; gap: var(--reader-gap, 1.2em) !important;\n  max-width: 100% !important; min-width: 0 !important;\n  overflow-x: auto !important; overflow-y: hidden !important;\n  overscroll-behaviour-inline: contain; box-sizing: border-box;\n}\n[data-reader-flow] > * { flex: 0 0 auto !important; min-width: 0; }\n[data-reader-grid] {\n  display: grid !important; grid-template-columns: var(--reader-columns) !important;\n  direction: rtl !important; gap: var(--reader-gap, 1.2em) !important;\n  max-width: 100% !important; min-width: 0 !important;\n}\n[data-reader-grid] > * { min-width: 0 !important; direction: ltr !important; }\n[data-reader-vertical] {\n  writing-mode: vertical-rl !important; text-orientation: mixed !important;\n  inline-size: var(--reader-height) !important; max-inline-size: var(--reader-height) !important;\n  min-inline-size: 0 !important; block-size: max-content !important;\n  max-block-size: none !important; overflow: visible !important;\n  white-space: normal !important; text-align: start !important;\n  line-height: 1.85 !important; line-break: strict !important; word-break: normal !important;\n  box-sizing: border-box;\n}\n[data-reader-role=\"heading\"][data-reader-vertical] {\n  inline-size: max-content !important; max-inline-size: var(--reader-height) !important;\n}\n[data-reader-horizontal] { writing-mode: horizontal-tb !important; }\n[data-reader-media]:not([data-reader-icon]) {\n  max-width: min(100%, 36rem) !important; max-height: 65vh !important; object-fit: contain;\n}\n[data-reader-icon] { max-width: var(--reader-icon-width) !important; max-height: var(--reader-icon-height) !important; }\n[data-reader-horizontal]:is(pre, table) { max-width: 100% !important; overflow: auto !important; }\n[data-reader-vertical] a { overflow-wrap: anywhere; }\n[data-reader-vertical] ruby { ruby-position: over; }\n[data-reader-vertical] rt { font-size: .5em; }\n.綴り-縦中横 { text-combine-upright: all; white-space: nowrap; }\n@media (max-width: 680px) {\n  [data-reader-grid] { grid-template-columns: minmax(0, 1fr) !important; }\n}\n";

export function makePlans(graph: PageGraph, inference: readonly Inference[]): Plan[] {
    const roles = new Map(inference.map((result) => [result.id, result]));
    const byID = new Map(graph.regions.map((region) => [region.id, region]));
    const zones = inferZones(graph, inference);
    return graph.regions.map((region) => {
        const result = roles.get(region.id)!;
        let parent = region.parent;
        let blocked = false;
        while (parent !== null) {
            const ancestor = byID.get(parent);
            blocked ||= Boolean(ancestor?.protected || ancestor?.tag === "nav");
            parent = ancestor?.parent ?? null;
        }
        const zone = zones.get(region.id) ?? "ordinary";
        const readable = result.scores.prose + result.scores.heading + result.scores.caption;
        const otherLanguage = region.lang.startsWith("zh") || region.lang.startsWith("ko");
        const functional = zone === "page" || zone === "footer" || zone === "navigation" || zone === "interface" || zone === "aside";
        // 意味分類が曖昧でも、言語・文書構造・リンク密度を合わせて本文を判定する。
        const structural = region.heading > 0 || ["p", "blockquote", "li", "dd", "dt", "figcaption"].includes(region.tag);
        const contextual = region.text.trim().length >= 8 && region.japanese > 0.4 && region.links < 0.6;
        const vertical = region.text.trim().length > 0 && region.japanese > 0.16
            && (readable > 0.35 || structural || contextual)
            && !region.protected && !blocked && !functional && !otherLanguage
            && region.width > 0 && region.height > 0 && region.display !== "none";
        return { id: region.id, role: result.role, confidence: result.confidence, zone, mode: vertical ? "vertical" : "horizontal" };
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
            const span = doc.createElement("span");
            span.className = "綴り-縦中横"; span.textContent = token.text; fragment.append(span);
        }
        node.replaceWith(fragment);
    }
}

/** 元のCSSと実測値を証拠として残し、必要な領域の書字方向と配置だけを再構築する。 */
export function emitLayout(doc: Document, graph: PageGraph, plans: readonly Plan[]): void {
    const before = doc.body.textContent;
    const elements = new Map(Array.from(doc.querySelectorAll<HTMLElement>("[data-tsuzuri-source]"),
        (element) => [Number(element.dataset.tsuzuriSource), element]));
    const regions = new Map(graph.regions.map((region) => [region.id, region]));
    const byPlan = new Map(plans.map((plan) => [plan.id, plan]));
    const modes = new Map(plans.map((plan) => [plan.id, plan.mode]));
    const zones = new Map(plans.map((plan) => [plan.id, plan.zone ?? "ordinary"]));
    const groups = inferGroups(graph, modes, zones);
    doc.body.dataset.readerPage = "";
    for (const plan of plans) {
        const element = elements.get(plan.id);
        const region = regions.get(plan.id);
        if (!element || !region) continue;
        element.dataset.readerRole = plan.role;
        element.dataset.readerZone = plan.zone ?? "ordinary";
        if (region.display === "none" || region.width === 0 || region.height === 0) element.hidden = true;
        const parentZone = region.parent === null ? undefined : byPlan.get(region.parent)?.zone;
        if (plan.zone === "footer" && parentZone !== "footer") element.dataset.readerLandmark = "footer";
        if (plan.zone === "header" && parentZone !== "header") element.dataset.readerLandmark = "header";
        if (plan.zone === "primary" && parentZone !== "primary") element.dataset.readerPrimary = "";
        if (["fixed", "sticky", "absolute"].includes(region.position) && plan.zone !== "media") {
            element.style.setProperty("position", "static", "important");
            element.style.setProperty("inset", "auto", "important");
            element.style.setProperty("transform", "none", "important");
        }
        const media = Boolean(region.visual?.image);
        const icon = media && region.width <= Math.max(64, region.fontSize * 3)
            && region.height <= Math.max(64, region.fontSize * 3);
        if (media) element.dataset.readerMedia = "";
        if (icon) {
            element.dataset.readerIcon = "";
            element.style.setProperty("--reader-icon-width", String(Math.max(1, Math.ceil(region.width))) + "px");
            element.style.setProperty("--reader-icon-height", String(Math.max(1, Math.ceil(region.height))) + "px");
        }
        // 構造的な外枠は横書きと決め付けず、内側の縦書き配置を受け入れる。
        if (plan.mode === "horizontal" && (region.protected
            || (region.text.trim() && !["body", "main", "article", "section"].includes(region.tag)))) element.dataset.readerHorizontal = "";
        if (plan.mode === "horizontal") continue;
        element.dataset.readerVertical = "";
        element.style.setProperty("writing-mode", "vertical-rl", "important");
        element.style.setProperty("inline-size", plan.role === "heading" ? "max-content" : "var(--reader-height)", "important");
        element.style.setProperty("max-inline-size", "var(--reader-height)", "important");
        element.style.setProperty("overflow", "visible", "important");
        element.classList.add("綴り-本文", "綴り-縦書", "綴り-組版");
        element.removeAttribute("data-reader-horizontal");
        combineNumbers(element, doc);
    }
    const children = new Map<number, Region[]>();
    for (const region of graph.regions) {
        if (region.parent === null) continue;
        const list = children.get(region.parent) ?? [];
        list.push(region);
        children.set(region.parent, list);
    }
    for (const [id, kind] of groups) {
        const element = elements.get(id);
        const region = regions.get(id);
        if (!element || !region) continue;
        const gap = Math.max(8, Math.min(48, region.visual?.gap || region.fontSize * 1.1));
        element.style.setProperty("--reader-gap", String(gap) + "px");
        if (kind === "flow") { element.dataset.readerFlow = ""; continue; }
        element.dataset.readerGrid = "";
        const columns = (children.get(id) ?? []).filter((child) => child.width > 0 && child.height > 0 && child.display !== "none");
        const total = columns.reduce((sum, child) => sum + child.width, 0);
        element.style.setProperty("--reader-columns", columns.map((child) => "minmax(0, " + String(child.width / Math.max(1, total) * 100) + "fr)").join(" "));
    }
    const style = doc.createElement("style");
    // 主領域が文章の流れそのものである場合、右端から左へ列を進める。
    style.textContent = READER_CSS + "\n[data-reader-primary] { direction: rtl !important; }"
        + "\n[data-reader-primary][data-reader-flow] { direction: ltr !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }"
        + "\n[data-reader-primary] > * { direction: ltr !important; }";
    style.dataset.readerStyle = "";
    doc.head.append(style);
    if (doc.body.textContent !== before) throw new Error("組版中に本文が変わったため中断しました。");
}

function cost(doc: Document): number {
    const view = doc.defaultView;
    if (!view) return Infinity;
    let result = Math.max(0, doc.documentElement.scrollWidth - view.innerWidth) / Math.max(1, view.innerWidth) * 4;
    for (const group of Array.from(doc.querySelectorAll<HTMLElement>("[data-reader-flow]"))) {
        const children = Array.from(group.children).filter((element) => !element.hasAttribute("hidden"));
        const box = group.getBoundingClientRect();
        for (let index = 1; index < children.length; index++) {
            const a = children[index - 1]!.getBoundingClientRect();
            const b = children[index]!.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            result += overlapX * overlapY / Math.max(1, box.width * box.height) * 10;
        }
    }
    for (const element of Array.from(doc.querySelectorAll<HTMLElement>("[data-reader-vertical]"))) {
        const box = element.getBoundingClientRect();
        if (box.width < 8 || box.height < 8) result += 5;
        if (box.height > view.innerHeight * 1.05) result += (box.height / Math.max(1, view.innerHeight) - 1) * 3;
    }
    return result;
}

/** 書字方向を確定した後、実測した衝突と画面外への突出から列の高さを選ぶ。 */
export function optimise(doc: Document, graph: PageGraph, plans: readonly Plan[]): Plan[] {
    const viewport = doc.defaultView?.innerHeight ?? graph.height;
    const candidates = [62, 75, 88] as const;
    let best: number = candidates[0];
    let minimum = Infinity;
    for (const ratio of candidates) {
        const height = Math.max(120, Math.min(800, viewport * ratio / 100));
        doc.documentElement.style.setProperty("--reader-height", String(height) + "px");
        const value = cost(doc) + Math.abs(height / Math.max(1, viewport) - 0.75) * 0.05;
        if (value < minimum) { minimum = value; best = ratio; }
    }
    // 初回の測定結果を割合で保存し、以後は表示領域の変化をCSSだけで処理する。
    doc.documentElement.style.setProperty("--reader-height", "clamp(120px, " + String(best) + "vh, 800px)");
    const revised = plans.map((plan): Plan => {
        const element = doc.querySelector<HTMLElement>('[data-tsuzuri-source="' + String(plan.id) + '"]');
        if (!element || plan.mode !== "vertical") return plan;
        const css = doc.defaultView?.getComputedStyle(element);
        const clipped = (css?.overflowX === "hidden" && element.scrollWidth > element.clientWidth + 4)
            || (css?.overflowY === "hidden" && element.scrollHeight > element.clientHeight + 4);
        if (!clipped) return plan;
        element.removeAttribute("data-reader-vertical");
        element.dataset.readerHorizontal = "";
        element.classList.remove("綴り-縦書");
        return { ...plan, mode: "horizontal" };
    });
    return revised;
}
