import { EMBEDDING_POLICY, ENGINE, MODEL, MODEL_REVISION } from "./types.ts";

/** Canonicalisation preserves meaningful query order and values. */
export function sourceURL(value: string, base?: string): URL {
    const trimmed = value.trim();
    const text = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
    const url = new URL(text, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("HTTP(S) の URL を指定してください。");
    if (url.username || url.password) throw new Error("認証情報を含む URL は使えません。");
    const host = url.hostname.toLowerCase();
    const octets = host.split(".").map(Number);
    const [a = -1, b = -1] = octets;
    const ipv4 = octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
    const local4 = ipv4 && (a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
    // Literal IPv6 addresses and local hostnames are not public reading sources.
    if (local4 || host.includes(":") || !host.includes(".") || host.endsWith(".localhost")
        || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("公開ウェブサイトの URL を指定してください。");
    return url;
}

export function readQuery(search: string): URL | null {
    const values = new URLSearchParams(search).getAll("w");
    if (values.length === 0) return null;
    if (values.length !== 1 || !values[0]) throw new Error("w パラメーターには URL を一つ指定してください。");
    return sourceURL(values[0]);
}

export function cacheKey(url: URL, width: number, height: number): string {
    const canonical = new URL(url);
    canonical.hash = "";
    return JSON.stringify([ENGINE, MODEL, MODEL_REVISION, EMBEDDING_POLICY, canonical.href, Math.round(width), Math.round(height)]);
}

export async function digest(text: string): Promise<string> {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
