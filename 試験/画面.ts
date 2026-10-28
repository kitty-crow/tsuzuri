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
    const 表記 = await 頁.locator(".綴り-原字").first().textContent();
    const 描画字 = await 頁.locator(".綴り-既定字").allTextContents();
    await 頁.evaluate(() => document.fonts.ready);
    const 書体 = await 頁.locator(".綴り-既定字").first()
        .evaluate((要素) => getComputedStyle(要素).fontFamily);
    const 読込済み = await 頁.evaluate(() =>
        Array.from(document.fonts).some((候補) =>
            候補.family.includes("IDS Composer Demo") && 候補.status === "loaded"
        )
    );
    const 選択 = await 頁.locator(".綴り-原字").first().evaluate((要素) => {
        const 選択範囲 = window.getSelection();
        選択範囲?.selectAllChildren(要素);
        return 選択範囲?.toString() ?? "";
    });
    if (合成数 < 4 || 縦書数 < 2 || 読み数 < 5 || 旧暦 !== "令和八年長月十八日"
        || 向き !== "vertical-rl" || 表記 !== "⿱日本" || 選択 !== "⿱日本"
        || 描画字.join("") !== "\uE100\uE101\uE102\uE103"
        || !書体.includes("IDS Composer Demo") || !読込済み || 例外.length > 0) {
        throw new Error(JSON.stringify({ 合成数, 縦書数, 読み数, 旧暦, 向き, 表記, 選択, 描画字, 書体, 読込済み, 例外 }));
    }
    await 頁.evaluate(() => {
        const 要素 = document.createElement("jp-furigana");
        要素.setAttribute("reading", "じどう");
        要素.textContent = "自動";
        document.body.append(要素);
    });
    await 頁.waitForFunction(() => Array.from(document.querySelectorAll("ruby.綴り-振仮名"))
        .some((要素) => 要素.textContent?.includes("じどう")));

    await 頁.evaluate(() => {
        const 見本 = document.createElement("jp-kanji");
        見本.textContent = "⿱⿰天地人";
        document.body.append(見本);
    });
    await 頁.waitForSelector(".綴り-伸縮字 .綴り-単字");
    const 伸縮 = await 頁.locator(".綴り-伸縮字 .綴り-単字").count();
    if (伸縮 !== 3) throw new Error("未知の合成文字の伸縮描画に失敗しました");
    console.log("実ブラウザーでの表示検査に合格しました。");
} finally {
    await ブラウザー.close();
    配信.stop();
}

