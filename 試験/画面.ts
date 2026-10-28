import { chromium } from "playwright";

const 配信 = Bun.serve({
    port: 0,
    fetch(要求) {
        const 道 = decodeURIComponent(new URL(要求.url).pathname);
        const 対象 = 道 === "/" ? "index.html" : 道.replace(/^\//, "");
        if (!["index.html", "様式.css", "物語.css", "支援.css", "配色.js", "目次.js", "支援.js", "dist/tsuzuri.js", "dist/tsuzuri.css", "dist/tsuzuri.js.map"].includes(対象)) {
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
        const 親 = document.createElement("div");
        親.id = "追加字の検査";
        const 見本 = document.createElement("jp-kanji");
        見本.textContent = "⿱⿰天地人";
        親.append(見本);
        document.body.append(親);
    });
    await 頁.waitForSelector("#追加字の検査 .綴り-伸縮字 .綴り-単字");
    const 伸縮 = await 頁.locator("#追加字の検査 .綴り-伸縮字 .綴り-単字").count();
    if (伸縮 !== 3) throw new Error("未知の合成文字の伸縮描画に失敗しました");

    const 見出し = await 頁.locator(".物語年月 .綴り-暦").allTextContents();
    const 期待 = [
        "文化六年己巳　霜月十六日",
        "文化八年辛未　卯月三日",
        "文化十年癸酉　長月十三日",
        "文化十一年甲戌　弥生二十日",
        "同年　葉月廿七日",
        "同年　長月九日",
        "同年　神無月十五日",
        "文化十一年甲戌　神無月十六日",
        "同年　神無月廿八日",
        "文化十二年乙亥　弥生吉日",
    ];
    const 日付属性 = await 頁.locator(".物語年月 time").evaluateAll((要素) =>
        要素.map((項目) => 項目.getAttribute("datetime"))
    );
    const 元の日付 = [
        "1809-12-22", "1811-05-24", "1813-10-06", "1814-05-09",
        "1814-10-10", "1814-10-21", "1814-11-26",
        "1814-11-27", "1814-12-09", "1815-04-15",
    ];
    const 人物の読み = await 頁.locator(".物語巻 ruby rt").allTextContents();
    const 表意文字 = await 頁.locator(".物語巻 .綴り-原字").allTextContents();
    const 巻数 = await 頁.locator(".物語巻").count();
    const 縦書本文数 = await 頁.locator(".物語巻 > .綴り-縦書").count();
    const 大題数 = await 頁.locator(".物語巻 h2.物語大題").count();
    const 後日題数 = await 頁.locator(".物語巻 h3.物語後日題").count();
    if (JSON.stringify(見出し) !== JSON.stringify(期待)) throw new Error("歴史的な章の日付が一致しません: " + JSON.stringify({ 見出し, 期待 }));
    if (JSON.stringify(日付属性) !== JSON.stringify(元の日付)) throw new Error("原稿の日付が西暦で保存されていません");
    if (巻数 !== 1 || 縦書本文数 !== 1 || 大題数 !== 1 || 後日題数 !== 1) {
        throw new Error("一つの巻物に全篇が収まっていません");
    }
    for (const 読み of ["せいしち", "はつね", "きゅうべえ", "かいとう", "ぬしさま"]) {
        if (!人物の読み.includes(読み)) throw new Error("人名の振仮名が欠けています: " + 読み);
    }
    for (const 構文 of ["⿱白萩", "⿰燈心", "⿱行燈", "⿰初音"]) {
        if (!表意文字.includes(構文)) throw new Error("合成文字が欠けています: " + 構文);
    }

    const 書状数 = await 頁.locator(".物語巻 blockquote.物語書状").count();
    const 強調数 = await 頁.locator(".物語巻 strong").count();
    const 斜体数 = await 頁.locator(".物語巻 em").count();
    const 流れ = await 頁.locator(".物語巻 .物語段落").first().evaluate((要素) => ({
        方向: getComputedStyle(要素).direction,
        揃え: getComputedStyle(要素).textAlign,
    }));
    if (書状数 < 7 || 強調数 < 8 || 斜体数 < 8) {
        throw new Error("Markdown の書状と強調が描画されていません: " + JSON.stringify({ 書状数, 強調数, 斜体数 }));
    }
    if (流れ.方向 !== "ltr" || 流れ.揃え !== "start") {
        throw new Error("縦書きの行が上から始まりません: " + JSON.stringify(流れ));
    }


    await 頁.evaluate(() => {
        const 箱 = document.createElement("div");
        箱.id = "組版の孤立防止検査";
        const 条件: readonly (readonly [number, number])[] = [[90, 16], [115, 20], [140, 24]];
        for (const [高さ, 大きさ] of 条件) {
            const 書面 = document.createElement("tsuzuri");
            const 段落 = document.createElement("p");
            段落.style.height = String(高さ) + "px";
            段落.style.fontSize = String(大きさ) + "px";
            段落.style.lineHeight = "1.3";
            段落.style.margin = "0";
            段落.textContent = "初音は枕元の木箱を開き簪や指輪長年に貯へし僅かばかりの銭を差し出したり";
            書面.append(段落);
            箱.append(書面);
        }
        const 注記の書面 = document.createElement("tsuzuri");
        const 注記の段落 = document.createElement("p");
        注記の段落.textContent = "清七は静かに";
        const 読み = document.createElement("jp-furigana");
        読み.setAttribute("reading", "しらはぎ");
        読み.textContent = "白萩";
        注記の段落.append(読み);
        注記の書面.append(注記の段落);
        箱.append(注記の書面);
        document.body.append(箱);
    });
    await 頁.waitForFunction(() =>
        document.querySelectorAll("#組版の孤立防止検査 .綴り-孤立防止").length === 4
    );
    const 孤立結果 = await 頁.locator("#組版の孤立防止検査 p").evaluateAll((段落一覧) =>
        段落一覧.map((段落) => {
            const 保護 = 段落.querySelector(".綴り-孤立防止");
            const 本文 = 保護?.textContent ?? "";
            const 改行不可 = 保護 ? getComputedStyle(保護).whiteSpace === "nowrap" : false;
            const 文字 = 保護?.firstChild;
            const 横位置: number[] = [];
            if (文字 instanceof Text) {
                for (let 位置 = 0; 位置 < 文字.length; 位置 += 1) {
                    const 範囲 = document.createRange();
                    範囲.setStart(文字, 位置);
                    範囲.setEnd(文字, 位置 + 1);
                    横位置.push(範囲.getBoundingClientRect().left);
                }
            }
            return {
                本文, 改行不可, 横位置,
                読み: 保護?.querySelector("ruby rt")?.textContent ?? "",
                保護数: 段落.querySelectorAll(".綴り-孤立防止").length,
            };
        })
    );
    for (const 結果 of 孤立結果.slice(0, 3)) {
        if (結果.本文 !== "したり" || !結果.改行不可 || 結果.保護数 !== 1) {
            throw new Error("末尾三字を保護できません: " + JSON.stringify(結果));
        }
        if (結果.横位置.length !== 3 || Math.max(...結果.横位置) - Math.min(...結果.横位置) > 2) {
            throw new Error("末尾が別の列に分断されています: " + JSON.stringify(結果));
        }
    }
    if (孤立結果[3]?.読み !== "しらはぎ" || !孤立結果[3]?.改行不可) {
        throw new Error("振仮名の保護に失敗しました: " + JSON.stringify(孤立結果[3]));
    }
    const 元の例 = await 頁.locator(".物語巻 .物語段落").filter({ hasText: "簪や指輪" }).first()
        .locator(".綴り-孤立防止").textContent();
    if (元の例 !== "したり") throw new Error("元の孤立字が残っています: " + 元の例);


    const 目次リンク = 頁.locator("#物語目次 a[data-target]");
    const 目次数 = await 目次リンク.count();
    const 目次の検証 = await 目次リンク.evaluateAll((一覧) =>
        一覧.every((リンク) => {
            const 識別 = (リンク as HTMLAnchorElement).dataset.target ?? "";
            const 見出し = document.getElementById(識別);
            return 見出し !== null && document.querySelector("#物語本文")?.contains(見出し);
        })
    );
    const 目次の方向 = await 頁.locator("#物語目次 > .綴り-縦書")
        .evaluate((要素) => getComputedStyle(要素).writingMode);
    const 展開の数 = await 頁.locator("#物語目次 details.目次開閉").count();
    if (目次数 !== 12 || !目次の検証 || 目次の方向 !== "vertical-rl" || 展開の数 !== 2) {
        throw new Error("縦書きの目次が見出しと一致しません: "
            + JSON.stringify({ 目次数, 目次の検証, 目次の方向, 展開の数 }));
    }
    const 後日譚の展開 = 頁.locator("#物語目次 details.目次開閉").last();
    if (await 後日譚の展開.evaluate((要素) => (要素 as HTMLDetailsElement).open)) {
        throw new Error("後日譚は初期状態で折り畳まれる必要があります");
    }
    await 後日譚の展開.locator("summary").click();
    if (!(await 後日譚の展開.evaluate((要素) => (要素 as HTMLDetailsElement).open))) {
        throw new Error("目次の展開操作に失敗しました");
    }
    const 巻物 = 頁.locator("#物語本文");
    await 巻物.scrollIntoViewIfNeeded();
    const 移動前 = await 巻物.evaluate((要素) => ({
        横: 要素.scrollLeft, 頁: window.scrollY,
    }));
    const 目標 = 頁.locator('.物語年月:has(time[datetime="1814-10-21"])');
    const 目標識別 = await 目標.getAttribute("id");
    if (!目標識別) throw new Error("目次に使う識別子がありません");
    const 跳躍先 = 頁.locator('#物語目次 a[data-target="' + 目標識別 + '"]');
    await 跳躍先.click();
    await 頁.waitForFunction((識別) => {
        const 見出し = document.getElementById(識別);
        const 巻物 = document.querySelector("#物語本文");
        if (!見出し || !巻物) return false;
        const ずれ = 見出し.getBoundingClientRect().right - 巻物.getBoundingClientRect().right;
        return Math.abs(ずれ + 28) < 52 && Math.abs(巻物.scrollLeft) > 100;
    }, 目標識別);
    await 頁.waitForFunction((識別) =>
        document.querySelector('#物語目次 a[data-target="' + 識別 + '"]')
            ?.getAttribute("aria-current") === "location", 目標識別);
    const 移動後 = await 巻物.evaluate((要素) => ({
        横: 要素.scrollLeft, 頁: window.scrollY,
    }));
    if (移動後.横 >= 移動前.横 || Math.abs(移動後.頁 - 移動前.頁) > 20) {
        throw new Error("巻物の横移動が不正です: " + JSON.stringify({ 移動前, 移動後 }));
    }
    if (!頁.url().endsWith("#" + encodeURIComponent(目標識別))) {
        throw new Error("目次の移動先が URL に記録されていません");
    }

    const ボタン = 頁.locator("#配色切替");
    const 初期の配色 = await 頁.locator("html").getAttribute("data-theme");
    const 初期の背景 = await 頁.locator("body").evaluate((要素) => getComputedStyle(要素).backgroundColor);
    await ボタン.click();
    const 新しい配色 = await 頁.locator("html").getAttribute("data-theme");
    const 新しい背景 = await 頁.locator("body").evaluate((要素) => getComputedStyle(要素).backgroundColor);
    if (新しい配色 === 初期の配色 || 新しい背景 === 初期の背景) {
        throw new Error("配色の切替が行われませんでした: " + JSON.stringify({
            初期の配色, 新しい配色, 初期の背景, 新しい背景,
            初期表示: await ボタン.textContent(),
            配色処理: await 頁.evaluate(() => ({
                定義: document.querySelector("script[src$='配色.js']")?.getAttribute("src"),
                保存: localStorage.getItem("綴り-配色"),
                様式: getComputedStyle(document.documentElement).getPropertyValue("--紙"),
            })),
        }));
    }
    await 頁.reload();
    const 保存済み = await 頁.locator("html").getAttribute("data-theme");
    if (保存済み !== 新しい配色) throw new Error("配色が保存されていません");
    const 斜体の形式 = await 頁.locator(".物語巻 em").first().evaluate((要素) => ({
        傾斜: getComputedStyle(要素).fontStyle,
        装飾: getComputedStyle(要素).textDecorationLine,
    }));
    if (!斜体の形式.傾斜.includes("italic") || !斜体の形式.装飾.includes("underline")) {
        throw new Error("斜体が読者に見える形で装飾されていません");
    }
    await ボタン.click();

    const 縦の支援 = 頁.locator(".支援側帯 .綴り-縦書");
    const 縦方向 = await 縦の支援.evaluate((要素) => getComputedStyle(要素).writingMode);
    const デスクトップ案内 = await 頁.locator(".支援側帯").evaluate((要素) => {
        const 装飾 = getComputedStyle(要素);
        return { 表示: 装飾.display, 固定: 装飾.position, 右: 装飾.right };
    });
    const 支援先 = await 頁.locator(".支援側帯").getAttribute("href");
    const 下部リンク = 頁.locator(".下部 .pages-kofi-link");
    const 下部版 = await 頁.locator(".下部版").textContent();
    if (縦方向 !== "vertical-rl" || デスクトップ案内.固定 !== "fixed"
        || デスクトップ案内.表示 === "none" || 支援先 !== "https://ko-fi.com/kittycrow"
        || await 下部リンク.getAttribute("href") !== 支援先 || !下部版?.includes("v0.1.0")) {
        throw new Error("日本語の縦書き支援案内とフッターが不正です: "
            + JSON.stringify({ 縦方向, デスクトップ案内, 支援先, 下部版 }));
    }

    // 外部の Ko-fi スクリプトを模擬し、携帯画面でも円形の表示を検査する。
    await 頁.route("https://storage.ko-fi.com/cdn/scripts/overlay-widget.js", async (通信) => {
        await 通信.fulfill({
            status: 200,
            contentType: "application/javascript",
            body: "window.kofiWidgetOverlay={draw:function(名前,設定){document.documentElement.dataset.kofiAccount=名前;const 外枠=document.createElement('div');外枠.className='floatingchat-container-wrap-mobi';const 内枠=document.createElement('iframe');内枠.title='珈琲で応援';外枠.append(内枠);document.body.append(外枠);}};",
        });
    });
    await 頁.setViewportSize({ width: 390, height: 840 });
    await 頁.waitForFunction(() => document.documentElement.dataset.kofiReady === "true");
    const 円形 = await 頁.locator(".floatingchat-container-wrap-mobi").evaluate((要素) => {
        const 装飾 = getComputedStyle(要素);
        return { 幅: 要素.getBoundingClientRect().width, 高さ: 要素.getBoundingClientRect().height,
            角丸: 装飾.borderRadius, 固定: 装飾.position, 左: 装飾.left, 下: 装飾.bottom };
    });
    const 名義 = await 頁.locator("html").getAttribute("data-kofi-account");
    const 円形の控え = await 頁.locator(".支援浮輪").evaluate((要素) => getComputedStyle(要素).visibility);
    const 携帯の縦帯 = await 頁.locator(".支援側帯").evaluate((要素) => getComputedStyle(要素).display);
    if (円形.幅 !== 56 || 円形.高さ !== 56 || 円形.角丸 !== "50%"
        || 円形.固定 !== "fixed" || 携帯の縦帯 !== "none"
        || 円形の控え !== "hidden" || 名義 !== "kittycrow") {
        throw new Error("携帯表示の円形ウィジェットが不正です: "
            + JSON.stringify({ 円形, 携帯の縦帯, 円形の控え, 名義 }));
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });
    await 頁.waitForFunction(() =>
        document.documentElement.dataset.kofiReady === "false"
        && !document.querySelector(".floatingchat-container-wrap-mobi"));
    console.log("実ブラウザーでの表示検査に合格しました。");
} finally {
    await ブラウザー.close();
    配信.stop();
}

