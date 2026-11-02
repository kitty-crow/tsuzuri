import { digest } from "./query.ts";
import { EMBEDDING_POLICY, MODEL, MODEL_REVISION, type SemanticEncoder, type SemanticResult } from "./types.ts";

/** Content-addressed embeddings survive page edits and viewport changes. */
export class CachedEncoder implements SemanticEncoder {
    constructor(private readonly encoder: SemanticEncoder) {}
    async encode(texts: readonly string[], signal: AbortSignal): Promise<SemanticResult> {
        const cache = typeof caches === "undefined" ? undefined : await caches.open("tsuzuri-reader-embeddings-v1").catch(() => undefined);
        const keys = await Promise.all(texts.map(async (text) => new URL("./__reader_embedding__/" + await digest(MODEL + MODEL_REVISION + EMBEDDING_POLICY + text), location.href).href));
        const stored = await Promise.all(keys.map(async (key): Promise<number[] | undefined> => {
            try {
                const response = await cache?.match(key);
                const value: unknown = await response?.json();
                return Array.isArray(value) && value.length === 384 && value.every((item) => typeof item === "number" && Number.isFinite(item)) ? value : undefined;
            } catch { return undefined; }
        }));
        signal.throwIfAborted();
        const known = new Map(keys.flatMap((key, index) => stored[index] ? [[key, stored[index]!] as const] : []));
        const missing = Array.from(new Map(texts.flatMap((text, index) => known.has(keys[index]!) ? [] : [[keys[index]!, { text, index }] as const])).values());
        const result = missing.length ? await this.encoder.encode(missing.map((entry) => entry.text), signal) : undefined;
        await Promise.all(missing.map(async (item, index) => {
            const vector = result?.vectors[index];
            if (!vector) throw new Error("意味解析の出力が不足しています。");
            stored[item.index] = [...vector];
            known.set(keys[item.index]!, [...vector]);
            await cache?.put(keys[item.index]!, new Response(JSON.stringify(vector), { headers: { "content-type": "application/json" } })).catch(() => undefined);
        }));
        // Bounded FIFO eviction. The compiled-page cache has independent byte and LRU limits.
        const entries = await cache?.keys();
        await Promise.all((entries?.slice(0, Math.max(0, entries.length - 2048)) ?? []).map((entry) => cache?.delete(entry)));
        return { vectors: keys.map((key) => known.get(key)!), model: MODEL + "@" + MODEL_REVISION + ":" + EMBEDDING_POLICY };
    }
}
