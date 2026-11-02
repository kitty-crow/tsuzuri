import { extensionReader, extensionSnapshot, recapture } from "../src/拡張/client.ts";
import type { PageGraph } from "../src/読取/types.ts";
import { ProgressView } from "./進捗.ts";
import { bookmarklet } from "../src/読取/bookmarklet.ts";
import { ReaderCache } from "../src/読取/cache.ts";
import { WebReader, type ReadResult } from "../src/読取/compiler.ts";
import { CachedEncoder } from "../src/読取/embeddings.ts";
import { LocalEncoder } from "../src/読取/model.ts";
import { cacheKey, readQuery, sourceURL } from "../src/読取/query.ts";
import { decodeHTML, loadFrame, sanitise, SOURCE_LIMIT } from "../src/読取/source.ts";

const script = document.currentScript;
const assets = new URL("./", script instanceof HTMLScriptElement ? script.src : location.href);
const store = new ReaderCache();
let controller = new AbortController();
let current: ReadResult | undefined;
let activeURL: URL | undefined;
let original = false;
let sourceTabId: number | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

function required<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error("読書画面を初期化できません。");
    return element;
}

function start(): void {
    const params = new URLSearchParams(location.search);
    if (extensionReader() && params.has("error")) { show(); progressView.update({ phase: "error" }); status.textContent = params.get("error"); return; }
    const snapshot = params.get("snapshot");
    if (extensionReader() && snapshot) {
        show(); progressView.start(); progressView.update({ phase: "receive" });
        void extensionSnapshot(snapshot).then((packet) => {
            sourceTabId = packet.sourceTabId;
            const back = required<HTMLAnchorElement>(panel, ".読書戻る"); back.href = packet.url; back.textContent = "元のページ"; back.target = "_blank";
            void open(sourceURL(packet.url), false, packet.html, packet.graph);
        }).catch((error: unknown) => { progressView.update({ phase: "error" }); status.textContent = error instanceof Error ? error.message : String(error); });
        return;
    }
    if (extensionReader() && !params.has("w")) { show(); progressView.update({ phase: "error" }); status.textContent = "読みたいサイトを開いて、拡張機能のアイコンを押してください。"; return; }
    let url: URL | null;
    try { url = readQuery(location.search); }
    catch (error) { show(); status.textContent = error instanceof Error ? error.message : String(error); return; }
    if (!url) return;
    show();
    const token = new URLSearchParams(location.search).get("capture");
    if (token && window.opener) { receiveSource(url, token); return; }
    void open(url);
}

const panel = document.createElement("section");
panel.className = "読書画面";
panel.setAttribute("aria-label", "綴りで読む");
panel.innerHTML = `<header class="読書操作">
  <div class="読書見出し"><a class="読書戻る">綴りへ</a><h1>綴りで読む</h1><p class="読書状態" role="status" aria-live="polite"></p></div>
  <form class="読書URL"><label><span>読みたいページ</span><input name="w" type="url" required placeholder="https://example.jp/"></label><button>縦書きで読む</button></form>
  <div class="読書道具"><label class="読書意味"><input type="checkbox" checked> 詳しい意味解析</label>
  <button type="button" class="読書原文" aria-pressed="false">元の配置</button>
  <button type="button" class="読書更新">更新</button>
  <button type="button" class="読書消去">保存を削除</button>
  </div><label class="読書取込"><span>ＨＴＭＬを開く</span><input type="file" accept=".html,.htm,text/html"></label>
  <p class="読書連携">この栞をブックマークバーへ。<a class="読書栞">綴りで読む</a>。読みたいサイトを開き、栞を押してください。</p>
  <a class="読書出典" target="_blank" rel="noopener noreferrer">出典を開く</a>
</header>`;
required<HTMLAnchorElement>(panel, ".読書栞").href = bookmarklet(new URL(location.pathname, location.origin).href);
const form = required<HTMLFormElement>(panel, "form");
const input = required<HTMLInputElement>(panel, "input[name=w]");
const semantic = required<HTMLInputElement>(panel, ".読書意味 input");
const status = required<HTMLParagraphElement>(panel, ".読書状態");
const attribution = required<HTMLAnchorElement>(panel, ".読書出典");
const toggle = required<HTMLButtonElement>(panel, ".読書原文");
required<HTMLAnchorElement>(panel, ".読書戻る").href = location.pathname;
const frame = document.createElement("iframe");
frame.className = "読書本文"; frame.title = "縦書きのページ"; frame.setAttribute("sandbox", "allow-same-origin allow-popups"); frame.referrerPolicy = "no-referrer";
const measure = document.createElement("iframe");
measure.className = "読書測定"; measure.title = "組版の測定"; measure.setAttribute("sandbox", "allow-same-origin"); measure.setAttribute("aria-hidden", "true"); measure.tabIndex = -1;
const progressView = new ProgressView();
required(panel, ".読書操作").append(progressView.element);
panel.append(frame, measure);
if (extensionReader()) { panel.classList.add("読書拡張"); required<HTMLElement>(panel, ".読書連携").hidden = true; }

function show(): void {
    document.body.append(panel); document.documentElement.classList.add("読書中");
    const robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex, nofollow"; document.head.append(robots);
}

function dimensions(): { width: number; height: number } {
    return { width: Math.max(280, frame.clientWidth), height: Math.max(160, frame.clientHeight) };
}

async function present(result: ReadResult, signal: AbortSignal): Promise<void> {
    const doc = await loadFrame(frame, sanitise(original ? result.page.source : result.page.html, sourceURL(result.page.baseURL)), signal);
    signal.throwIfAborted();
    doc.addEventListener("click", (event) => {
        const target = event.target;
        const anchor = target && "closest" in target && typeof target.closest === "function" ? target.closest("a") : null;
        if (!anchor || !anchor.getAttribute("href")) return;
        const href = anchor.getAttribute("href")!;
        if (href.startsWith("#")) { event.preventDefault(); doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView(); return; }
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        try { void open(sourceURL(href, result.page.url)); } catch { status.textContent = "このリンクは縦書きで開けません。"; }
    });
    const vertical = result.page.plans.filter((plan) => plan.mode === "vertical").length;
    const age = new Date(result.page.created).toLocaleString("ja-JP");
    status.textContent = (result.cached ? "保存済みの組版を表示しました。" : "組版が完了しました。")
        + " 縦書き " + String(vertical) + " 領域。" + (result.page.model === "structural" ? " 構造解析。" : " 意味解析済み。")
        + " 保存日時: " + age + "。" + result.warning;
}

async function open(url: URL, refresh = false, html?: string, observation?: PageGraph): Promise<void> {
    controller.abort(); controller = new AbortController();
    const signal = controller.signal;
    if (activeURL?.href !== url.href) current = undefined;
    activeURL = url; input.value = url.href; attribution.href = url.href;
    const address = new URL(location.href); address.searchParams.set("w", url.href); history.replaceState(null, "", address);
    progressView.start();
    status.textContent = "保存済みの組版を確認しています。";
    const size = dimensions(); measure.style.width = String(size.width) + "px"; measure.style.height = String(size.height) + "px";
    const encoder = semantic.checked ? new CachedEncoder(new LocalEncoder(new URL("reader-model.js", assets))) : undefined;
    const preview = new AbortController();
    signal.addEventListener("abort", () => preview.abort(), { once: true });
    const reader = new WebReader({
        progress: (value) => { if (!signal.aborted) progressView.update(value); },
        preview: (source) => { void loadFrame(frame, source, preview.signal).catch(() => undefined); },
        frame: measure, store, ...size, ...(encoder ? { encoder } : {}), status: (message) => { if (!signal.aborted) status.textContent = message; } });
    try {
        const result = await reader.read(url, signal, refresh, html, observation);
        signal.throwIfAborted(); current = result;
        preview.abort();
        progressView.update({ phase: "display" });
        await present(result, signal);
        progressView.update({ phase: "complete" });
        if (result.cached && Date.now() - result.page.created > 24 * 60 * 60 * 1000) status.textContent += " 更新で最新のページを読み込めます。";
    } catch (error) {
        preview.abort();
        if (signal.aborted) return;
        progressView.update({ phase: "error" });
        status.textContent = (error instanceof Error ? error.message : String(error))
            + " サイトが直接の取得を許可しない場合は、上の「綴りで読む」をブックマークバーに追加し、元のサイト上で実行してください。保存したHTMLも開けます。";
    }
}

/** Only the source tab which opened this reader may supply a snapshot. */
function receiveSource(url: URL, token: string): void {
    activeURL = url; input.value = url.href; attribution.href = url.href;
    progressView.start(); progressView.update({ phase: "receive" });
    status.textContent = "元のページを受け取っています。";
    const opener: Window = window.opener;
    const cleanup = (): void => { clearTimeout(timer); clearInterval(retry); window.removeEventListener("message", receive); };
    const fail = (message: string): void => { cleanup(); progressView.update({ phase: "error" }); status.textContent = message; };
    const timer = setTimeout(() => fail("ページを受け取れませんでした。解析は開始していません。拡張機能またはHTMLの取込を使ってください。"), 15000);
    const receive = (event: MessageEvent<unknown>): void => {
        if (event.source !== opener || event.origin !== url.origin) return;
        const data = event.data;
        if (typeof data !== "object" || data === null || !("type" in data) || data.type !== "tsuzuri-source") return;
        if (!("token" in data) || data.token !== token || !("url" in data) || typeof data.url !== "string" || !("html" in data) || typeof data.html !== "string") return;
        let actual: URL;
        try { actual = sourceURL(data.url); } catch { return; }
        if (actual.origin !== url.origin) return;
        if (new TextEncoder().encode(data.html).byteLength > SOURCE_LIMIT) { fail("ページが大きすぎます（上限2 MiB）。"); return; }
        cleanup(); opener.postMessage({ type: "tsuzuri-received", token }, url.origin);
        const address = new URL(location.href); address.searchParams.delete("capture"); history.replaceState(null, "", address);
        void open(actual, false, data.html);
    };
    window.addEventListener("message", receive);
    const ready = (): void => opener.postMessage({ type: "tsuzuri-ready", token }, url.origin);
    const retry = setInterval(ready, 500); ready();
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    try { void open(sourceURL(input.value)); } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});
toggle.addEventListener("click", () => {
    original = !original; toggle.setAttribute("aria-pressed", String(original)); toggle.textContent = original ? "縦書きの配置" : "元の配置";
    if (current) void present(current, controller.signal).catch(() => undefined);
});
required(panel, ".読書更新").addEventListener("click", () => {
    if (extensionReader() && sourceTabId !== undefined) { void recapture(sourceTabId).catch(() => { status.textContent = "元のタブを開き直して、拡張機能を押してください。"; }); return; }
    if (activeURL) void open(activeURL, true);
});
semantic.addEventListener("change", () => { if (activeURL) void open(activeURL, false, current?.page.source, extensionReader() ? current?.page.graph : undefined); });
required(panel, ".読書消去").addEventListener("click", () => {
    if (!activeURL) return;
    const key = cacheKey(activeURL, dimensions().width, dimensions().height);
    void Promise.all([store.delete(key + ":semantic"), store.delete(key + ":structural")]).then(() => { status.textContent = "この表示サイズの保存済みページを削除しました。"; }).catch(() => { status.textContent = "削除できませんでした。"; });
});
required<HTMLInputElement>(panel, "input[type=file]").addEventListener("change", (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file || !activeURL) { status.textContent = "先に元のウェブサイトのURLを入力してください。"; return; }
    if (file.size > SOURCE_LIMIT) { status.textContent = "HTMLは2 MiB以内にしてください。"; return; }
    const url = activeURL;
    void file.arrayBuffer().then((buffer) => open(url, true, decodeHTML(new Uint8Array(buffer), "text/html"))).catch(() => { status.textContent = "HTMLを読み込めませんでした。"; });
});
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    if (!activeURL || !current) return;
    resizeTimer = setTimeout(() => { if (activeURL && current) void open(activeURL, false, current.page.source, extensionReader() ? current.page.graph : undefined); }, 350);
});
start();
