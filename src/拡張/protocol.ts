import type { PageGraph } from "../読取/types.ts";

export type PageCapture = Readonly<{ url: string; html: string; graph: PageGraph }>;
export type StoredCapture = PageCapture & Readonly<{ id: string; sourceTabId: number; capturedAt: number }>;
export function isCapture(value: unknown): value is StoredCapture {
    if (typeof value !== "object" || value === null) return false;
    return "url" in value && typeof value.url === "string" && "html" in value && typeof value.html === "string"
        && "graph" in value && typeof value.graph === "object" && value.graph !== null && "regions" in value.graph && Array.isArray(value.graph.regions)
        && "edges" in value.graph && Array.isArray(value.graph.edges)
        && "id" in value && typeof value.id === "string" && "sourceTabId" in value && typeof value.sourceTabId === "number"
        && "capturedAt" in value && typeof value.capturedAt === "number";
}
