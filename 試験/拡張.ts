/// <reference types="chrome" />
import { chromium } from "playwright";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ANCHORS } from "../src/読取/infer.ts";

const folder = await mkdtemp(join(tmpdir(), "tsuzuri-extension-test-"));
await cp(resolve("extension-dist"), folder, { recursive: true });
await cp(join(folder, "reader-model.js"), join(folder, "reader-model-real.js"));
const manifest = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8")) as { permissions: string[]; host_permissions: string[] };
if (manifest.permissions.includes("tabs") || manifest.host_permissions.includes("<all_urls>")) throw new Error("不要な全サイト権限があります");
// ツールバーを押せない自動試験では、試験用の複製だけに対象サイトの権限を付ける。
manifest.host_permissions.push("https://extension-fixture.example/*");
await writeFile(join(folder, "manifest.json"), JSON.stringify(manifest));
await writeFile(join(folder, "reader-model.js"), `const anchors=${JSON.stringify(Object.values(ANCHORS))};self.onmessage=({data})=>self.postMessage({id:data.id,vectors:data.kind==="initialise"?[]:data.texts.map(text=>Array.from({length:384},(_,j)=>Number(j===Math.max(0,anchors.indexOf(text)))))})`);
const context = await chromium.launchPersistentContext("", {
    channel: "chromium", headless: true, viewport: { width: 1200, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--disable-extensions-except=" + folder, "--load-extension=" + folder],
});
try {
    const background = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const extensionID = new URL(background.url()).host;
    let sourceRequests = 0;
    await context.route("https://extension-fixture.example/**", async (route) => {
        sourceRequests++;
        await route.fulfill({ contentType: "text/html; charset=utf-8", headers: { "cross-origin-opener-policy": "same-origin", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" }, body: '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>拡張の試験</title><style>article{width:540px}p{font-size:20px}.invisible{display:none}</style></head><body><article><h1>白萩の物語</h1><p id="live" data-tsuzuri-source="original"><ruby>白萩<rt>しらはぎ</rt></ruby>の花が咲く庭で、長い物語を読みました。</p><p class="invisible">隠れた文章</p><pre>const 日本語 = 1;</pre></article></body></html>' });
    });
    await context.addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined }); Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }); });
    const source = await context.newPage();
    await source.goto("https://extension-fixture.example/article");
    await source.evaluate(() => { const p = document.createElement("p"); p.id = "dynamic"; p.textContent = "画面に後から追加された日本語も読めます。"; document.querySelector("article")?.append(p); });
    const tabId = await background.evaluate(async () => (await chrome.tabs.query({ url: "https://extension-fixture.example/*" }))[0]?.id);
    if (tabId === undefined) throw new Error("試験のタブがありません");
    const reader = await context.newPage();
    reader.setDefaultTimeout(20000);
    await reader.goto("chrome-extension://" + extensionID + "/index.html");
    const activate = async (): Promise<void> => {
        await reader.evaluate((id) => { void chrome.runtime.sendMessage({ type: "capture-tab", tabId: id }).catch(() => undefined); }, tabId);
        await reader.waitForURL("**/*snapshot=*");
        await reader.waitForFunction(() => document.querySelector(".読書進捗")?.getAttribute("data-phase") === "complete");
    };
    await activate();
    const frame = reader.frameLocator(".読書本文");
    if (await frame.locator("ruby").textContent() !== "白萩しらはぎ") throw new Error("ルビが失われました");
    if (await frame.locator("#dynamic").textContent() !== "画面に後から追加された日本語も読めます。") throw new Error("動的な文章が失われました");
    if (await frame.locator("#live").evaluate((element) => getComputedStyle(element).writingMode) !== "vertical-rl") throw new Error("縦書きになりません");
    const order = await frame.locator("article").evaluate((article) => {
        const first = article.querySelector("h1")?.getBoundingClientRect();
        const next = article.querySelector("#live")?.getBoundingClientRect();
        return { first: first?.x ?? -1, next: next?.x ?? -1,
            right: article.getBoundingClientRect().right, width: article.ownerDocument.documentElement.clientWidth };
    });
    if (order.first <= order.next || order.right < order.width * 0.85) throw new Error("縦書きの列が右端から左へ進んでいません: " + JSON.stringify(order));
    if (await source.locator("#live").getAttribute("data-tsuzuri-source") !== "original") throw new Error("元のページを変更しました");
    if (sourceRequests !== 1) throw new Error("元のページを再取得しました");
    const packet = await reader.evaluate(async () => {
        const id = new URLSearchParams(location.search).get("snapshot");
        const stored = await chrome.storage.session.get("capture:" + id);
        return stored["capture:" + id] as { graph: { regions: { tag: string; fontSize: number }[] } };
    });
    if (!packet.graph.regions.some((region) => region.tag === "p" && region.fontSize === 20)) throw new Error("実際の書式を読み取れていません");
    await reader.screenshot({ path: "extension-test.png" });
    // 再取得した内容が同じなら、保存済みの組版を表示する。
    const firstURL = reader.url();
    await reader.locator(".読書引手").click();
    await reader.locator(".読書更新").click();
    await reader.waitForFunction((oldURL) => location.href !== oldURL, firstURL);
    await reader.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存済みの組版を表示"));
    if (sourceRequests !== 1) throw new Error("更新時に元のページを取得しました");
    // 拡張機能のCSPで同梱WASMを初期化できることを確認する。
    const wasm = await reader.evaluate(async () => {
        const module = await import(chrome.runtime.getURL("onnx/ort-wasm-simd-threaded.mjs"));
        const factory = module.default as (options: { locateFile: (path: string) => string }) => Promise<{ _malloc: unknown }>;
        const runtime = await factory({ locateFile: (path) => chrome.runtime.getURL("onnx/" + path) });
        return typeof runtime._malloc;
    });
    if (wasm !== "function") throw new Error("同梱されたWASMを初期化できません");
    // 配布用ワーカーでモデルを取得し、拡張機能内で実際に意味解析する。
    const vectors = await reader.evaluate(async () => {
        const worker = new Worker(chrome.runtime.getURL("reader-model-real.js"), { type: "module" });
        try {
            return await new Promise<number[][]>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("実モデルの読込が時間切れです")), 180000);
                worker.onerror = (event): void => { clearTimeout(timer); reject(new Error(event.message)); };
                worker.onmessage = (event: MessageEvent<{ id?: number; error?: string; vectors?: number[][] }>): void => {
                    const data = event.data;
                    if (data.error) { clearTimeout(timer); reject(new Error(data.error)); return; }
                    if (data.id === 1) { worker.postMessage({ id: 2, kind: "encode", texts: ["日本語の物語を縦書きで読みます。", "この文章の意味を調べます。"] }); return; }
                    if (data.id !== 2 || !data.vectors) return;
                    clearTimeout(timer); resolve(data.vectors);
                };
                worker.postMessage({ id: 1, kind: "initialise", device: "wasm" });
            });
        } finally { worker.terminate(); }
    });
    if (vectors.length !== 2 || vectors.some((row) => row.length !== 384 || row.some((value) => !Number.isFinite(value)))) throw new Error("実モデルの意味解析結果が不正です");
    console.log("拡張機能: 実DOMと書式の取得・動的文章・縦書き・ルビ・元タブの保持・キャッシュ・同梱WASM・実モデルのローカル解析を確認しました。");
} finally { await context.close(); }
