import { chromium, type Route } from "playwright";
import { join } from "node:path";
import { ANCHORS } from "../src/読取/infer.ts";

const fixture = `<!doctype html><html lang="ja"><head><title>白萩の庭</title>
<style>body{font-family:serif;margin:20px}.grid{display:grid;grid-template-columns:3fr 1fr;gap:20px}h1{font-size:36px}p{font-size:18px}nav{display:flex;gap:20px}.gone{display:none}</style>
<script>parent.document.body.dataset.compromised='yes'</script></head><body>
<nav><a href="/home">ホーム</a><a href="/stories">物語</a></nav><main class="grid"><article>
<h1>白萩の庭</h1><p id="intro"><ruby>白萩<rt>しらはぎ</rt></ruby>の花が咲く庭で、二人は言葉を交わした。<a href="/next?chapter=2">続きを読む</a>。</p>
<div id="unknown">風が吹くと花は揺れた。長い文章を読み進めるための静かな場所だった。日本語の文章は美しい。</div>
<p id="numbers">第12章には2026年の記録と<em>大切な言葉</em>がある。</p>
<figure><img width="80" height="50" alt="白萩の花" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9kAAAAASUVORK5CYII="><figcaption>庭に咲く白萩。</figcaption></figure>
<table id="prices"><tr><th>商品</th><th>価格</th></tr><tr><td>本</td><td>一万円</td></tr></table>
<pre id="code">const 日本語 = 12;</pre><p class="gone" id="concealed">隠された文章</p>
</article><aside><h2>関連する物語</h2><a href="/story">ほかの作品</a><form><label>検索<input value="日本語" onfocus="alert(1)"></label><button>検索</button></form></aside></main>
<a href="javascript:alert(1)">危険なリンク</a><iframe srcdoc="<script>alert(1)</script>"></iframe></body></html>`;
const worker = `const anchors=${JSON.stringify(Object.values(ANCHORS))};self.onmessage=({data})=>{if(data.kind==="initialise")fetch(new URL("./__lane-started?device="+data.device,self.location.href));setTimeout(()=>self.postMessage({id:data.id,vectors:data.kind==="initialise"?[]:data.texts.map(text=>Array.from({length:384},(_,j)=>Number(j===Math.max(0,anchors.indexOf(text)))))}),data.kind==="initialise"?0:10)};`;

const server = Bun.serve({
    port: 0,
    fetch(request) {
        const path = decodeURIComponent(new URL(request.url).pathname);
        if (path.includes("..")) return new Response("invalid", { status: 400 });
        const file = Bun.file(join("site", path === "/" ? "index.html" : path));
        return new Response(file);
    },
});
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined }); Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }); });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let requests = 0;
    let workers = 0;
    const devices = new Set<string>();
    const routeRequest = async (route: Route): Promise<void> => {
        const url = new URL(route.request().url());
        if (url.pathname === "/__lane-started") { devices.add(url.searchParams.get("device") ?? ""); await route.fulfill({ body: "ok" }); return; }
        if (url.hostname === "reader-fixture.example" && url.pathname === "/blocked") { await route.abort(); return; }
        if (url.hostname === "reader-fixture.example") { requests++; await route.fulfill({ body: fixture, contentType: "text/html", headers: { "access-control-allow-origin": "*" } }); return; }
        if (url.pathname.endsWith("/reader-model.js")) { workers++; await route.fulfill({ body: worker, contentType: "application/javascript" }); return; }
        if (url.hostname !== "127.0.0.1") { await route.abort(); return; }
        await route.continue();
    };
    await page.route("**/*", routeRequest);
    const target = "http://127.0.0.1:" + String(server.port) + "/?w=" + encodeURIComponent("https://reader-fixture.example/article");
    await page.goto(target);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    const content = page.frameLocator(".読書本文");
    const result = await content.locator("body").evaluate((body) => {
        const style = (selector: string): string => getComputedStyle(body.querySelector(selector)!).writingMode;
        return { intro: style("#intro"), table: style("#prices"), code: style("#code"), ruby: body.querySelector("ruby")?.textContent,
            text: body.textContent, numbers: body.querySelector("#numbers .綴り-縦中横")?.textContent,
            hidden: getComputedStyle(body.querySelector("#concealed")!).display,
            dangerous: body.querySelector("script, iframe, [onclick], [onfocus], [href^='javascript:']") !== null };
    });
    if (result.intro !== "vertical-rl" || result.table !== "horizontal-tb" || result.code !== "horizontal-tb"
        || result.ruby !== "白萩しらはぎ" || result.numbers !== "12" || result.hidden !== "none" || result.dangerous
        || !result.text?.includes("大切な言葉") || await page.locator("body").getAttribute("data-compromised")) throw new Error("読書結果が不正: " + JSON.stringify(result));
    const firstRequests = requests;
    const firstWorkers = workers;
    if (firstRequests !== 1 || firstWorkers !== 1) throw new Error("初回の処理回数が不正");
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存済みの組版を表示"));
    if (requests !== firstRequests || workers !== firstWorkers) throw new Error("保存済みのページを再計算しました");
    await page.locator(".読書原文").click();
    await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>(".読書本文")?.contentDocument?.querySelector("#intro")?.hasAttribute("data-reader-vertical") === false);
    await page.locator(".読書原文").click();
    await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>(".読書本文")?.contentDocument?.querySelector("#intro")?.hasAttribute("data-reader-vertical") === true);
    await page.locator(".読書更新").click();
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (requests !== firstRequests + 1 || workers !== firstWorkers) throw new Error("更新時に文章の意味解析を再計算しました");
    // A different viewport gets a new layout, while the content-addressed embeddings survive.
    await page.setViewportSize({ width: 600, height: 850 });
    await page.waitForTimeout(500);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (requests !== firstRequests + 1 || workers !== firstWorkers) throw new Error("表示サイズの変更時に再取得または再推論しました");
    const overflow = await content.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth + 2);
    if (overflow) throw new Error("ページ全体が表示領域をはみ出しています");
    await page.screenshot({ path: "/tmp/tsuzuri-reader-mobile.png" });
    // A CORS failure offers local import, which uses the same compiler and cache.
    await page.goto("http://127.0.0.1:" + String(server.port) + "/?w=" + encodeURIComponent("https://reader-fixture.example/blocked"));
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存したHTML"));
    await page.locator("input[type=file]").setInputFiles({ name: "source.html", mimeType: "text/html", buffer: Buffer.from(fixture) });
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (workers !== firstWorkers) throw new Error("取込時に既知の文章を再推論しました");
    // Browsers which deny persistent storage must still be able to display a reading view.
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { get: () => { throw new Error("storage denied"); } }));
    await page.goto(target);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存できませんでした"));
    // Exercise the browser adapter and worker protocol with both devices available.
    const hybrid = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await hybrid.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({ features: new Set(["shader-f16"]) }) } });
        Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 });
    });
    devices.clear();
    await hybrid.route("**/*", routeRequest);
    await hybrid.goto(target);
    await hybrid.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (!devices.has("webgpu") || !devices.has("wasm")) throw new Error("GPUとWASMを同時に初期化できませんでした");
    await hybrid.close();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("読書画面: 組版・ルビ・保護領域・安全性・永続キャッシュ・更新・再配置を確認しました。");
} finally { await browser.close(); server.stop(true); }
