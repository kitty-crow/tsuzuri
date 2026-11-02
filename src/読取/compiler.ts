import { ANCHORS, infer } from "./infer.ts";
import { emitLayout, makePlans, optimise } from "./layout.ts";
import { observePage } from "./observe.ts";
import { cacheKey, digest } from "./query.ts";
import { fetchSource, loadFrame, sanitise } from "./source.ts";
import { ENGINE, ROLES, type PageGraph, type PageStore, type ProgressSink, type SavedPage, type SemanticEncoder } from "./types.ts";

export type ReadResult = Readonly<{ page: SavedPage; cached: boolean; warning: string }>;
type Options = Readonly<{
    frame: HTMLIFrameElement; store: PageStore; encoder?: SemanticEncoder;
    width: number; height: number; status: (message: string) => void;
    progress?: ProgressSink;
    preview?: (html: string, url: URL) => void;
}>;
export class WebReader {
    constructor(private readonly options: Options) {}
    async read(url: URL, signal: AbortSignal, refresh = false, imported?: string, observation?: PageGraph): Promise<ReadResult> {
        const { store, width, height } = this.options;
        this.options.progress?.({ phase: "cache" });
        const key = cacheKey(url, width, height) + (this.options.encoder ? ":semantic" : ":structural");
        const cached = await store.get(key).catch(() => undefined);
        signal.throwIfAborted();
        if (cached && !refresh && imported === undefined) return { page: cached, cached: true, warning: "" };
        this.options.status("ページを読み込んでいます。");
        this.options.progress?.({ phase: "fetch" });
        const source = imported === undefined ? await fetchSource(url, signal) : { html: imported, url };
        const hash = await digest(source.html + (observation ? JSON.stringify(observation) : ""));
        if (cached && !refresh && cached.hash === hash) return { page: cached, cached: true, warning: "" };
        // HTMLが同じでも外部CSSが変わるため、明示的な更新では書式を再測定する。
        return this.compile(source.html, source.url, url, key, hash, signal, observation);
    }
    private async compile(raw: string, finalURL: URL, requestedURL: URL, key: string, hash: string, signal: AbortSignal, observation?: PageGraph): Promise<ReadResult> {
        const { frame, width, height, encoder, status } = this.options;
        status("文章とレイアウトを解析しています。");
        this.options.progress?.({ phase: "observe" });
        const source = sanitise(raw, finalURL);
        const doc = await loadFrame(frame, source, signal);
        signal.throwIfAborted();
        const graph = observation ? { ...observation, width, height } : observePage(doc, width, height);
        // 意味モデルの待機中も構造解析で生成した縦書きの仮組版を表示する。
        const preliminary = makePlans(graph, infer(graph, new Map(), []));
        emitLayout(doc, graph, preliminary);
        optimise(doc, graph, preliminary);
        this.options.preview?.("<!doctype html>\n" + doc.documentElement.outerHTML, finalURL);
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
        this.options.progress?.({ phase: "layout" });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        signal.throwIfAborted();
        const finalDoc = await loadFrame(frame, source, signal);
        signal.throwIfAborted();
        // 原文を再表示した測定枠には、元の領域番号を付け直す。
        if (!observation) observePage(finalDoc, width, height);
        emitLayout(finalDoc, graph, plans);
        const revised = optimise(finalDoc, graph, plans);
        const html = "<!doctype html>\n" + finalDoc.documentElement.outerHTML;
        const now = Date.now();
        const partial = { key, engine: ENGINE, url: requestedURL.href, baseURL: finalURL.href, title: finalDoc.title, source, hash, html, graph, plans: revised, model, created: now, accessed: now, bytes: 0 };
        const page: SavedPage = { ...partial, bytes: new TextEncoder().encode(JSON.stringify(partial)).byteLength };
        signal.throwIfAborted();
        this.options.progress?.({ phase: "save" });
        try { await this.options.store.put(page); }
        catch { warning += " このブラウザーでは結果を保存できませんでした。"; }
        return { page, cached: false, warning };
    }
    private async semantic(encoder: SemanticEncoder, texts: readonly string[], signal: AbortSignal): Promise<{ vectors: readonly (readonly number[])[]; model: string; warning: string }> {
        this.options.status("意味解析を実行しています。初回はモデルを取得します。");
        // 長い文章は冒頭・中央・末尾から抜粋して意味解析に渡す。
        const sampled = texts.map((text) => text.length <= 768 ? text : text.slice(0, 256) + "\n" + text.slice(Math.floor(text.length / 2), Math.floor(text.length / 2) + 256) + "\n" + text.slice(-256));
        try { return { ...await encoder.encode([...ROLES.map((role) => ANCHORS[role]), ...sampled], signal, this.options.progress), warning: "" }; }
        catch (error) {
            signal.throwIfAborted();
            const reason = error instanceof Error ? error.message : String(error);
            return { vectors: [], model: "structural", warning: "意味解析を利用できないため、構造と配置から組版しました。 " + reason };
        }
    }
}
