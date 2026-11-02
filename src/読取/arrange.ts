import type { Inference, PageGraph, Region, Zone } from "./types.ts";

type Summary = { length: number; linked: number; size: number };
const empty = (): Summary => ({ length: 0, linked: 0, size: 0 });

/** 親子関係と画面上の相対位置からページ全体の役割を推定する。 */
export function inferZones(graph: PageGraph, inference: readonly Inference[]): Map<number, Zone> {
    const regions = new Map(graph.regions.map((region) => [region.id, region]));
    const children = new Map<number, number[]>();
    for (const region of graph.regions) {
        if (region.parent === null) continue;
        const group = children.get(region.parent) ?? [];
        group.push(region.id);
        children.set(region.parent, group);
    }
    const summaries = new Map<number, Summary>();
    const aggregate = (id: number): Summary => {
        const saved = summaries.get(id);
        if (saved) return saved;
        const region = regions.get(id)!;
        const own = { length: region.text.length, linked: region.links * region.text.length, size: 1 };
        for (const child of children.get(id) ?? []) {
            const other = aggregate(child);
            own.length += other.length;
            own.linked += other.linked;
            own.size += other.size;
        }
        summaries.set(id, own);
        return own;
    };
    for (const region of graph.regions) aggregate(region.id);

    const root = graph.regions.find((region) => region.tag === "body");
    let shell = root?.id;
    for (let depth = 0; depth < 4 && shell !== undefined; depth++) {
        const group = children.get(shell) ?? [];
        if (group.length !== 1) break;
        const child = regions.get(group[0]!);
        if (!child || child.width < graph.width * 0.6 || child.text.trim()) break;
        shell = child.id;
    }
    const peers = (shell === undefined ? [] : (children.get(shell) ?? []).map((id) => regions.get(id)!))
        .filter((region) => region.width > 0 && region.height > 0);
    const extent = Math.max(graph.height, ...graph.regions.map((region) => region.y + region.height));
    const order = [...peers].sort((a, b) => a.y - b.y);
    const first = order[0];
    const last = order.at(-1);
    const total = shell === undefined ? empty() : aggregate(shell);
    const linkedShare = (region: Region): number => {
        const data = aggregate(region.id);
        return data.linked / Math.max(1, data.length);
    };
    const footerCandidate = last && peers.length >= 2 && last.y > extent * 0.55
        && last.width >= graph.width * 0.55 && linkedShare(last) > 0.22
        && aggregate(last.id).length < Math.max(250, total.length * 0.4) ? last.id : -1;
    const headerCandidate = first && peers.length >= 2 && first.y < graph.height * 0.24
        && first.height < graph.height * 0.32 && linkedShare(first) > 0.35 ? first.id : -1;
    const inferred = new Map(inference.map((item) => [item.id, item]));
    const zones = new Map<number, Zone>();
    const visit = (id: number, inherited: Zone): void => {
        const region = regions.get(id)!;
        const predicted = inferred.get(id);
        const zone: Zone = inherited === "footer" ? "footer"
            : region.tag === "body" ? "page"
            : region.tag === "footer" || region.role === "contentinfo" || id === footerCandidate ? "footer"
            : region.tag === "header" || region.role === "banner" || id === headerCandidate ? "header"
            : region.tag === "aside" || region.role === "complementary" ? "aside"
            : region.tag === "nav" || region.role === "navigation" || predicted?.role === "navigation" && region.links > 0.5 ? "navigation"
            : region.tag === "main" || region.tag === "article" || region.role === "main" ? "primary"
            : region.visual?.image ? "media"
            : region.protected && !["header", "footer", "navigation", "aside"].includes(inherited) ? "interface"
            : inherited;
        zones.set(id, zone);
        for (const child of children.get(id) ?? []) visit(child, zone);
    };
    for (const region of graph.regions.filter((region) => region.parent === null)) visit(region.id, "ordinary");

    // 同じ高さの主要領域に隣接する細い列は、内容と幅を合わせて補助領域と判定する。
    for (const [, ids] of children) {
        const group = ids.map((id) => regions.get(id)!).filter((region) => region.width > 0);
        if (group.length < 2) continue;
        const widest = Math.max(...group.map((region) => region.width));
        for (const region of group) {
            if (zones.get(region.id) !== "ordinary" && zones.get(region.id) !== "primary") continue;
            const aligned = group.some((other) => other.id !== region.id && Math.abs(other.y - region.y) < 24 && other.width > region.width * 1.8);
            const secondary = region.width < widest * 0.46 && linkedShare(region) > 0.2;
            if (!aligned || !secondary) continue;
            const mark = (id: number): void => {
                const current = zones.get(id);
                if (current !== "ordinary" && current !== "primary") return;
                zones.set(id, "aside");
                for (const child of children.get(id) ?? []) mark(child);
            };
            mark(region.id);
        }
    }
    return zones;
}

/** 縦書きの文章と複数列のページ構造を分け、直接の子要素だけを配置対象にする。 */
export function inferGroups(graph: PageGraph, modes: ReadonlyMap<number, "vertical" | "horizontal">, zones: ReadonlyMap<number, Zone>): Map<number, "flow" | "grid"> {
    const regions = new Map(graph.regions.map((region) => [region.id, region]));
    const children = new Map<number, Region[]>();
    for (const region of graph.regions) {
        if (region.parent === null) continue;
        const group = children.get(region.parent) ?? [];
        group.push(region);
        children.set(region.parent, group);
    }
    const groups = new Map<number, "flow" | "grid">();
    for (const [parent, items] of children) {
        const region = regions.get(parent)!;
        const visible = items.filter((item) => item.width > 0 && item.height > 0 && item.display !== "none");
        if (visible.length < 2) continue;
        const zone = zones.get(parent);
        if (zone === "footer" || zone === "header" || zone === "navigation" || zone === "aside" || zone === "interface") continue;
        const vertical = visible.filter((item) => modes.get(item.id) === "vertical");
        const reading = vertical.length >= 2 && vertical.length / visible.length >= 0.45;
        if (reading) { groups.set(parent, "flow"); continue; }
        const aligned = visible.every((item) => Math.abs(item.y - visible[0]!.y) < 20);
        const distinct = visible.some((item) => item.x > visible[0]!.x + visible[0]!.width * 0.5 || item.x + item.width < visible[0]!.x);
        const source = region.display === "grid" || region.display === "flex";
        if (aligned && distinct && source) groups.set(parent, "grid");
    }
    return groups;
}
