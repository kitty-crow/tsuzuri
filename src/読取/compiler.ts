import { ANCHORS, infer } from "./infer.ts";
import { emitLayout, makePlans, optimise } from "./layout.ts";
import { observePage } from "./observe.ts";
import { cacheKey, digest } from "./query.ts";
import { fetchSource, loadFrame, sanitise } from "./source.ts";
import { ENGINE, ROLES, type PageStore, type SavedPage, type SemanticEncoder } from "./types.ts";

export type ReadResult = Readonly<{ page: SavedPage; cached: boolean; warning: string }>;
type Options = Readonly<{
    frame: HTMLIFrameElement; store: PageStore; encoder?: SemanticEncoder;
    width: number; height: number; status: (message: string) => void;
}>;
export class WebReader {
    constructor(private readonly options: Options) {}
    async read(url: URL, signal: AbortSignal, refresh = false, imported?: string): Promise<ReadResult> {
        const { store, width, height } = this.options;
        const key = cacheKey(url, width, height) + (this.options.encoder ? ":semantic" : ":structural");
        const cached = await store.get(key).catch(() => undefined);
        signal.throwIfAborted();
        if (cached && !refresh && imported === undefined) return { page: cached, cached: true, warning: "" };
        this.options.status("ページを読み込んでいます。");
        const source = imported === undefined ? await fetchSource(url, signal) : { html: imported, url };
        const hash = await digest(source.html);
        if (cached && !refresh && cached.hash === hash) return { page: cached, cached: true, warning: "" };
        // Explicit refresh remeasures styles, because external CSS can change independently of HTML.
        return this.compile(source.html, source.url, url, key, hash, signal);
    }
    private async compile(raw: string, finalURL: URL, requestedURL: URL, key: string, hash: string, signal: AbortSignal): Promise<ReadResult> {
        const { frame, width, height, encoder, status } = this.options;
        status("文章とレイアウトを解析しています。");
        const source = sanitise(raw, finalURL);
        const doc = await loadFrame(frame, source, signal);
        const graph = observePage(doc, width, height);
        const candidates = graph.regions.filter((region) => region.text.trim() && !region.protected)
            .sort((a, b) => b.text.length - a.text.length).slice(0, 384);
        const vectors = new Map<number, readonly number[]>();
        let anchors: readonly (readonly number[])[] = [];
        let model = "structural";
        let warning = "";
        if (encoder) {
            const result = await this.semantic(encoder, candidates.map((region) => region.text), signal);
            warning = result.warning;
            model = result.model;
            anchors = result.vectors.slice(0, ROLES.length);
            candidates.forEach((region, index) => {
                const vector = result.vectors[index + ROLES.length];
                vectors.set(region.id, vector ?? []);
            });
        }
        signal.throwIfAborted();
        const inference = infer(graph, vectors, anchors);
        const plans = makePlans(graph, inference);
        status("縦書きの配置を測定しています。");
        emitLayout(doc, graph, plans);
        const revised = optimise(doc, graph, plans);
        const html = "<!doctype html>\n" + doc.documentElement.outerHTML;
        const now = Date.now();
        const partial = { key, engine: ENGINE, url: requestedURL.href, baseURL: finalURL.href, title: doc.title, source, hash, html, graph, plans: revised, model, created: now, accessed: now, bytes: 0 };
        const page: SavedPage = { ...partial, bytes: new TextEncoder().encode(JSON.stringify(partial)).byteLength };
        signal.throwIfAborted();
        try { await this.options.store.put(page); }
        catch { warning += " このブラウザーでは結果を保存できませんでした。"; }
        return { page, cached: false, warning };
    }
    private async semantic(encoder: SemanticEncoder, texts: readonly string[], signal: AbortSignal): Promise<{ vectors: readonly (readonly number[])[]; model: string; warning: string }> {
        this.options.status("意味解析を実行しています。初回はモデルを取得します。");
        // Extractive windows include the beginning, middle and end without generating text.
        const sampled = texts.map((text) => text.length <= 768 ? text : text.slice(0, 256) + "\n" + text.slice(Math.floor(text.length / 2), Math.floor(text.length / 2) + 256) + "\n" + text.slice(-256));
        try { return { ...await encoder.encode([...ROLES.map((role) => ANCHORS[role]), ...sampled], signal), warning: "" }; }
        catch (error) {
            signal.throwIfAborted();
            const reason = error instanceof Error ? error.message : String(error);
            return { vectors: [], model: "structural", warning: "意味解析を利用できないため、構造と配置から組版しました。 " + reason };
        }
    }
}
