import DOMPurify from "dompurify";
import { sourceURL } from "./query.ts";

export const SOURCE_LIMIT = 2 * 1024 * 1024;
const CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: http:; img-src https: http: data:; font-src https: http: data:; connect-src 'none'; form-action 'none'";

function encoding(contentType: string): string | undefined {
    const entry = contentType.split(";").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith("charset="));
    return entry?.slice(8).split('"').join("").split("'").join("");
}

export function decodeHTML(bytes: Uint8Array, contentType: string): string {
    const preview = new TextDecoder().decode(bytes.slice(0, 4096));
    const meta = new DOMParser().parseFromString(preview, "text/html").querySelector("meta[charset], meta[http-equiv='content-type' i]");
    const label = encoding(contentType) ?? meta?.getAttribute("charset") ?? encoding(meta?.getAttribute("content") ?? "") ?? "utf-8";
    return new TextDecoder(label).decode(bytes);
}

export async function fetchSource(url: URL, signal: AbortSignal): Promise<{ html: string; url: URL }> {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: "omit", mode: "cors", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error("取得できませんでした: HTTP " + String(response.status));
    const finalURL = sourceURL(response.url || url.href);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("HTML ページを指定してください。");
    if (Number(response.headers.get("content-length")) > SOURCE_LIMIT) throw new Error("ページが大きすぎます（上限 2 MiB）。");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("本文を読み込めません。");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > SOURCE_LIMIT) throw new Error("ページが大きすぎます（上限 2 MiB）。");
            chunks.push(chunk.value);
        }
    } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { html: decodeHTML(bytes, contentType), url: finalURL };
}

function resource(value: string, base: URL, images = false): string | null {
    if (images && ["data:image/png;", "data:image/jpeg;", "data:image/gif;", "data:image/webp;"].some((prefix) => value.startsWith(prefix))) return value;
    try { return sourceURL(value, base.href).href; } catch { return null; }
}

/** 保存済みのHTMLも表示前に無害化する。 */
export function sanitise(html: string, url: URL): string {
    if (new TextEncoder().encode(html).byteLength > SOURCE_LIMIT * 8) throw new Error("保存されたページが大きすぎます。");
    const clean = DOMPurify.sanitize(html, {
        WHOLE_DOCUMENT: true, USE_PROFILES: { html: true }, ADD_TAGS: ["link", "style"],
        FORBID_TAGS: ["script", "iframe", "object", "embed", "base", "meta", "template", "noscript"],
        FORBID_ATTR: ["srcdoc", "srcset", "action", "formaction", "autofocus", "ping", "download", "is"],
    });
    const doc = new DOMParser().parseFromString(clean, "text/html");
    for (const link of Array.from(doc.querySelectorAll("link"))) {
        if (link.rel.toLowerCase() !== "stylesheet") { link.remove(); continue; }
        link.referrerPolicy = "no-referrer";
    }
    for (const element of Array.from(doc.querySelectorAll("[src], [href], [poster]"))) {
        for (const name of ["src", "href", "poster"]) {
            const value = element.getAttribute(name);
            if (!value || value.startsWith("#")) continue;
            const resolved = resource(value, url, name !== "href");
            if (resolved) element.setAttribute(name, resolved);
            if (!resolved) element.removeAttribute(name);
        }
    }
    for (const control of Array.from(doc.querySelectorAll("input, button, select, textarea"))) control.setAttribute("disabled", "");
    for (const editable of Array.from(doc.querySelectorAll("[contenteditable]"))) editable.removeAttribute("contenteditable");
    for (const anchor of Array.from(doc.querySelectorAll("a"))) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    const policy = doc.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = CSP + "; base-uri " + url.origin;
    doc.head.prepend(policy);
    const base = doc.createElement("base"); base.href = url.href; doc.head.append(base);
    const referrer = doc.createElement("meta");
    referrer.name = "referrer"; referrer.content = "no-referrer"; doc.head.prepend(referrer);
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
}

export async function loadFrame(frame: HTMLIFrameElement, html: string, signal: AbortSignal): Promise<Document> {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(), 6000);
        const finish = (error?: unknown): void => {
            clearTimeout(timer); frame.removeEventListener("load", loaded); signal.removeEventListener("abort", aborted);
            if (error) { reject(error); return; }
            resolve();
        };
        const loaded = (): void => finish();
        const aborted = (): void => finish(signal.reason ?? new DOMException("Aborted", "AbortError"));
        frame.addEventListener("load", loaded, { once: true });
        signal.addEventListener("abort", aborted, { once: true });
        frame.srcdoc = html;
    });
    signal.throwIfAborted();
    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error("ページを表示できません。");
    await Promise.race([doc.fonts.ready, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
    signal.throwIfAborted();
    return doc;
}
