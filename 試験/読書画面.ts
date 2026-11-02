import { chromium, type Route } from "playwright";
import { join } from "node:path";
import { ANCHORS } from "../src/読取/infer.ts";

const fixture = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>白萩の庭</title>
<style>body{font-family:serif;margin:20px}.grid{display:grid;grid-template-columns:3fr 1fr;gap:20px}h1{font-size:36px}p{font-size:18px}nav{display:flex;gap:20px}.gone{display:none}.foot{position:fixed;bottom:0;left:0;width:100%;padding:8px;border-top:1px solid #999;background:#eee}.icon{width:20px;height:20px}</style>
<script>parent.document.body.dataset.compromised='yes'</script></head><body>
<nav><a href="/home">ホーム</a><a href="/stories">物語</a></nav><main class="grid"><article>
<h1>白萩の庭</h1><p id="intro"><ruby>白萩<rt>しらはぎ</rt></ruby>の花が咲く庭で、二人は言葉を交わした。<a href="/next?chapter=2">続きを読む</a>。</p>
<div id="unknown">風が吹くと花は揺れた。長い文章を読み進めるための静かな場所だった。日本語の文章は美しい。</div>
<p id="numbers">第12章には2026年の記録と<em>大切な言葉</em>がある。</p>
<figure><img width="80" height="50" alt="白萩の花" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9kAAAAASUVORK5CYII="><figcaption>庭に咲く白萩。</figcaption></figure>
<table id="prices"><tr><th>商品</th><th>価格</th></tr><tr><td>本</td><td>一万円</td></tr></table>
<pre id="code">const 日本語 = 12;</pre><p class="gone" id="concealed">隠された文章</p>
</article><aside><h2>関連する物語</h2><a href="/story">ほかの作品</a><form><label>検索<input value="日本語" onfocus="alert(1)"></label><button>検索</button></form></aside></main>
<footer class="foot"><img class="icon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9kAAAAASUVORK5CYII=" alt="小さな絵"><a href="/about">運営情報</a><a href="/policy">利用案内</a></footer><a href="javascript:alert(1)">危険なリンク</a><iframe srcdoc="<script>alert(1)</script>"></iframe></body></html>`;
const worker = `const anchors=${JSON.stringify(Object.values(ANCHORS))};self.onmessage=({data})=>{if(data.kind==="initialise")fetch(new URL("./__lane-started?device="+data.device,self.location.href));setTimeout(()=>self.postMessage({id:data.id,vectors:data.kind==="initialise"?[]:data.texts.map(text=>Array.from({length:384},(_,j)=>Number(j===Math.max(0,anchors.indexOf(text)))))}),data.kind==="initialise"?0:10)};`;
const progressWorker = `const anchors=${JSON.stringify(Object.values(ANCHORS))};self.onmessage=({data})=>{
if(data.kind==="initialise"){
self.postMessage({progress:{file:"model",status:"progress",loaded:0,total:104857600}});
setTimeout(()=>self.postMessage({progress:{file:"model",status:"progress",loaded:52428800,total:104857600}}),400);
setTimeout(()=>{self.postMessage({progress:{file:"model",status:"done",loaded:104857600,total:104857600}});self.postMessage({id:data.id,vectors:[]})},1400);
return;}
setTimeout(()=>self.postMessage({id:data.id,vectors:data.texts.map(text=>Array.from({length:384},(_,j)=>Number(j===Math.max(0,anchors.indexOf(text)))))}),250);
};`;

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
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let requests = 0;
    let workers = 0;
    let slow = false;
    const devices = new Set<string>();
    const routeRequest = async (route: Route): Promise<void> => {
        const url = new URL(route.request().url());
        if (url.pathname === "/__lane-started") { devices.add(url.searchParams.get("device") ?? ""); await route.fulfill({ body: "ok" }); return; }
        if (url.hostname === "reader-fixture.example" && url.pathname === "/blocked") { await route.abort(); return; }
        if (url.hostname === "reader-fixture.example") { requests++; await route.fulfill({ body: fixture, contentType: "text/html", headers: { "access-control-allow-origin": "*" } }); return; }
        if (url.pathname.endsWith("/reader-model.js")) { workers++; await route.fulfill({ body: slow ? progressWorker : worker, contentType: "application/javascript" }); return; }
        if (url.hostname !== "127.0.0.1") { await route.abort(); return; }
        await route.continue();
    };
    await page.route("**/*", routeRequest);
    const target = "http://127.0.0.1:" + String(server.port) + "/?w=" + encodeURIComponent("https://reader-fixture.example/article");
    await page.goto("http://127.0.0.1:" + String(server.port));
    await page.waitForSelector("#読書 .綴り-縦書");
    const verticalTool = await page.locator("#読書 h2").evaluate((element) => getComputedStyle(element).writingMode);
    if (verticalTool !== "vertical-rl") throw new Error("読書入口が縦書きではありません");
    await page.locator("#読書").screenshot({ path: "/tmp/tsuzuri-tool-vertical.png" });
    await page.goto(target);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了")).catch(async () => {
        const value = await page.locator(".読書状態").textContent();
        const phase = await page.locator(".読書進捗").getAttribute("data-phase");
        throw new Error("最初の組版が完了しません: " + String(value) + " / " + String(phase));
    });
    // 自動収納・引手・固定・固定の保存を確認する。
    if (await page.locator(".読書画面").getAttribute("data-menu-pinned") !== "false") throw new Error("操作が初期状態で固定されています");
    const closed = await page.locator(".読書本文").evaluate((element) => element.getBoundingClientRect().width);
    await page.locator(".読書引手").click();
    await page.waitForTimeout(450);
    const expanded = await page.locator(".読書本文").evaluate((element) => element.getBoundingClientRect().width);
    if (expanded >= closed) throw new Error("操作を開いても本文が広がりません");
    await page.locator(".読書固定").click();
    if (await page.locator(".読書画面").getAttribute("data-menu-pinned") !== "true") throw new Error("操作を固定できません");
    const content = page.frameLocator(".読書本文");
    const result = await content.locator("body").evaluate((body) => {
        const style = (selector: string): string => getComputedStyle(body.querySelector(selector)!).writingMode;
        return { intro: style("#intro"), table: style("#prices"), code: style("#code"), ruby: body.querySelector("ruby")?.textContent,
            text: body.textContent, numbers: body.querySelector("#numbers .綴り-縦中横")?.textContent,
            hidden: getComputedStyle(body.querySelector("#concealed")!).display,
            dangerous: body.querySelector("script, iframe, [onclick], [onfocus], [href^='javascript:']") !== null,
            footer: getComputedStyle(body.querySelector(".foot")!).position,
            footerZone: body.querySelector(".foot")?.getAttribute("data-reader-zone"),
            iconWidth: body.querySelector(".icon")?.getBoundingClientRect().width,
            sourceStyle: Array.from(body.ownerDocument.querySelectorAll("style")).some((style) => style.textContent?.includes(".foot{position:fixed")),
            layout: getComputedStyle(body.querySelector("main")!).display };
    });
    if (result.intro !== "vertical-rl" || result.table !== "horizontal-tb" || result.code !== "horizontal-tb"
        || result.ruby !== "白萩しらはぎ" || result.numbers !== "12" || result.hidden !== "none" || result.dangerous
        || !result.text?.includes("大切な言葉") || result.footer !== "static" || result.footerZone !== "footer"
        || !result.iconWidth || result.iconWidth > 22 || !result.sourceStyle || result.layout !== "grid"
        || await page.locator("body").getAttribute("data-compromised")) throw new Error("読書結果が不正: " + JSON.stringify(result));
    if (requests !== 1 || workers !== 1) throw new Error("初回の処理回数が不正");
    // 固定中は本文幅が異なるので、初回の再配置後に同じ幅のキャッシュを確認する。
    await page.reload();
    await page.waitForFunction(() => {
        const status = document.querySelector(".読書状態")?.textContent ?? "";
        return status.includes("組版が完了") || status.includes("保存済みの組版を表示");
    });
    if (await page.locator(".読書画面").getAttribute("data-menu-pinned") !== "true") throw new Error("操作の固定が保存されていません");
    const firstRequests = requests;
    const firstWorkers = workers;
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存済みの組版を表示"));
    await page.locator(".読書固定").click();
    if (requests !== firstRequests || workers !== firstWorkers) throw new Error("保存済みのページを再計算しました");
    if (await page.locator('[role="progressbar"]').getAttribute("aria-valuenow") !== "100") throw new Error("保存済みの表示が完了になりません");
    if (await page.locator(".読書原文").evaluate((element) => getComputedStyle(element).writingMode) !== "vertical-rl") throw new Error("読書操作が縦書きではありません");
    await page.locator(".読書原文").click();
    await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>(".読書本文")?.contentDocument?.querySelector("#intro")?.hasAttribute("data-reader-vertical") === false);
    await page.locator(".読書原文").click();
    await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>(".読書本文")?.contentDocument?.querySelector("#intro")?.hasAttribute("data-reader-vertical") === true);
    await page.locator(".読書更新").click();
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (requests !== firstRequests + 1 || workers !== firstWorkers) throw new Error("更新時に文章の意味解析を再計算しました");
    // 画面幅を変えると組版をやり直し、保存済みの意味ベクトルを再利用する。
    await page.setViewportSize({ width: 600, height: 850 });
    await page.waitForTimeout(500);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (requests !== firstRequests + 1 || workers !== firstWorkers) throw new Error("表示サイズの変更時に再取得または再推論しました");
    const overflow = await content.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth + 2);
    if (overflow) {
        const detail = await content.locator("html").evaluate((root) => ({
            width: root.clientWidth, scroll: root.scrollWidth,
            protruding: Array.from(root.querySelectorAll<HTMLElement>("body *")).map((element) => {
                const box = element.getBoundingClientRect();
                return { tag: element.tagName, id: element.id, classes: element.className,
                    zone: element.dataset.readerZone, role: element.dataset.readerRole,
                    left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
            }).filter((item) => item.right > root.clientWidth + 2 || item.left < -2)
              .sort((a, b) => b.right - a.right).slice(0, 15),
        }));
        throw new Error("ページ全体が表示領域をはみ出しています: " + JSON.stringify(detail));
    }
    await page.screenshot({ path: "/tmp/tsuzuri-reader-mobile.png" });
    // 直接取得できない場合も、HTMLファイルを同じ処理で組版できる。
    await page.goto("http://127.0.0.1:" + String(server.port) + "/?w=" + encodeURIComponent("https://reader-fixture.example/blocked"));
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存したHTML"));
    await page.locator("input[type=file]").setInputFiles({ name: "source.html", mimeType: "text/html", buffer: Buffer.from(fixture) });
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (workers !== firstWorkers) throw new Error("取込時に既知の文章を再推論しました");
    // 保存を拒否する環境でも読書画面を表示できる。
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { get: () => { throw new Error("storage denied"); } }));
    await page.goto(target);
    await page.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("保存できませんでした"));
    // WebGPUとWASMを同時に使う場合の初期化と通信を確認する。
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
    // 別のオリジンで栞を実行し、表示中のDOMを受け取る。
    const source = await browser.newPage();
    source.setDefaultTimeout(15000);
    await source.context().addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined }); Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }); });
    await source.context().route("**/*", routeRequest);
    const captureCode = await page.locator(".読書栞").getAttribute("href");
    const beforeCapture = requests;
    await source.goto("https://reader-fixture.example/article");
    const popupPromise = source.waitForEvent("popup");
    await source.evaluate((code) => { eval(code?.slice("javascript:".length) ?? ""); }, captureCode);
    const captured = await popupPromise;
    captured.setDefaultTimeout(15000);
    await captured.waitForFunction(() => document.querySelector(".読書状態")?.textContent?.includes("組版が完了"));
    if (requests !== beforeCapture + 1) throw new Error("ブックマーク連携が元のサイトを再取得しました");
    if (await captured.frameLocator(".読書本文").locator("ruby").textContent() !== "白萩しらはぎ") throw new Error("受け取った本文が不正です");
    await source.close(); await captured.close();
    // 元の配置の表示中に、ワーカーからの進捗報告を確認する。
    slow = true;
    const progressPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await progressPage.addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined }); });
    await progressPage.route("**/*", routeRequest);
    await progressPage.goto(target);
    await progressPage.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") === "50");
    await progressPage.frameLocator(".読書本文").locator("#intro").waitFor();
    const previewMode = await progressPage.frameLocator(".読書本文").locator("#intro")
        .evaluate((element) => getComputedStyle(element).writingMode);
    if (previewMode !== "vertical-rl") throw new Error("意味解析中の仮組版が縦書きになっていません");
    if (!(await progressPage.locator(".読書残時間").textContent())?.includes("約")) throw new Error("モデルの残り時間がありません");
    await progressPage.screenshot({ path: "/tmp/tsuzuri-reader-progress.png" });
    await progressPage.waitForFunction(() => document.querySelector(".読書進捗")?.getAttribute("data-phase") === "analyse");
    await progressPage.waitForFunction(() => document.querySelector(".読書進捗")?.getAttribute("data-phase") === "complete");
    if (await progressPage.locator('[role="progressbar"]').getAttribute("aria-valuenow") !== "100") throw new Error("組版後に進捗が完了しません");
    await progressPage.close();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("読書画面: 組版・ルビ・保護領域・安全性・永続キャッシュ・更新・再配置を確認しました。");
} finally { await browser.close(); server.stop(true); }
