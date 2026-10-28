import { chromium } from "playwright";

const 配信 = Bun.serve({
    port: 0,
    fetch(要求) {
        const 道 = new URL(要求.url).pathname;
        const 対象 = 道 === "/" ? "index.html" : 道.replace(/^\//, "");
        if (!["index.html", "様式.css", "dist/tsuzuri.js", "dist/tsuzuri.css", "dist/tsuzuri.js.map"].includes(対象)) {
            return new Response("未登録", { status: 404 });
        }
        return new Response(Bun.file("site/" + 対象));
    },
});
const ブラウザー = await chromium.launch({ headless: true });
try {
    const 頁 = await ブラウザー.newPage();
    const 例外: string[] = [];
    頁.on("pageerror", (例外内容) => 例外.push(例外内容.message));
    await 頁.goto("http://127.0.0.1:" + String(配信.port));
    await 頁.waitForSelector(".綴り-文字");
    const 合成数 = await 頁.locator(".綴り-文字").count();
    const 縦書数 = await 頁.locator(".綴り-縦書").count();
    const 読み数 = await 頁.locator(".綴り-振仮名").count();
    const 旧暦 = await 頁.locator(".綴り-暦").first().textContent();
    const 向き = await 頁.locator(".綴り-縦書").first().evaluate((要素) => getComputedStyle(要素).writingMode);
    const 表記 = await 頁.locator(".綴り-文字").first().textContent();
    if (合成数 < 4 || 縦書数 < 2 || 読み数 < 5 || 旧暦 !== "令和八年長月十八日"
        || 向き !== "vertical-rl" || 表記 !== "⿱日本" || 例外.length > 0) {
        throw new Error(JSON.stringify({ 合成数, 縦書数, 読み数, 旧暦, 向き, 表記, 例外 }));
    }
    console.log("実ブラウザーでの表示検査に合格しました。");
} finally {
    await ブラウザー.close();
    配信.stop();
}

