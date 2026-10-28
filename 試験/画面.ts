import { chromium } from "playwright";

const 配信 = Bun.serve({
    port: 0,
    fetch(要求) {
        const 道 = decodeURIComponent(new URL(要求.url).pathname);
        const 対象 = 道 === "/" ? "index.html" : 道.replace(/^\//, "");
        if (!["index.html", "綴.svg", "様式.css", "物語.css", "支援.css", "配色.js", "目次.js", "dist/tsuzuri.js", "dist/tsuzuri.css", "dist/tsuzuri.js.map"].includes(対象)) {
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
    const 標章 = 頁.locator(".上部 .印 img.印章");
    const 標章の読込 = await 標章.evaluate((要素) => {
        const 画像 = 要素 as HTMLImageElement;
        return { 読込: 画像.complete, 幅: 画像.naturalWidth, 高さ: 画像.naturalHeight,
            代替: 画像.alt, 元: 画像.getAttribute("src") };
    });
    const アイコン先 = await 頁.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
    const 印の文字 = await 頁.locator(".上部 .印").textContent();
    const 標章の原文 = await 頁.evaluate(async () => {
        const 応答 = await fetch("./綴.svg");
        return 応答.ok ? await 応答.text() : "";
    });
    if (!標章の読込.読込 || 標章の読込.幅 !== 128 || 標章の読込.高さ !== 128
        || 標章の読込.代替 !== "" || アイコン先 !== "./綴.svg"
        || 標章の読込.元 !== アイコン先 || !印の文字?.includes("り") || 印の文字.includes("綴")
        || !標章の原文.includes("<path ") || 標章の原文.includes("<text ")) {
        throw new Error("文字を輪郭化した標章とファビコンが不正です: "
            + JSON.stringify({ 標章の読込, アイコン先, 印の文字 }));
    }

    const 印字 = await 頁.locator(".上部 .印 .印字").textContent();
    if (印字 !== "り") throw new Error("標章と綴りの文字が重複しています: " + 印字);

    const 組版方向 = await 頁.evaluate(() => {
        const 対象 = (選択: string): Element => {
            const 要素 = document.querySelector(選択);
            if (!要素) throw new Error("必要な表示要素がありません: " + 選択);
            return 要素;
        };
        const 複数 = (選択: string): string[] =>
            Array.from(document.querySelectorAll(選択), (要素) => getComputedStyle(要素).writingMode);
        const 右側 = 対象(".上部").getBoundingClientRect();
        const 左側 = 対象(".下部").getBoundingClientRect();
        const 支援 = 対象(".支援側帯").getBoundingClientRect();
        const 読む人 = 対象("body");
        return {
            書体: getComputedStyle(読む人).fontFamily,
            頭右: 右側.right,
            足左: 左側.left,
            支援下: 支援.bottom,
            支援上: 支援.top,
            頭下: 右側.bottom,
            画面幅: window.innerWidth,
            画面高: window.innerHeight,
            導入: 複数(".主題縦案内 > .綴り-縦書"),
            章題: 複数(".縦案内節 > .節題 > .綴り-縦書"),
            手順: 複数(".手順題 > .綴り-縦書"),
            個別: 複数(".一覧題 > .綴り-縦書"),
            物語: 複数(".物語冒頭 > .綴り-縦書"),
            主題: 複数(".主題見出し > .綴り-縦書"),
            足方向: getComputedStyle(対象(".下部版")).writingMode,
            頭方向: getComputedStyle(対象(".上部 nav a")).writingMode,
            足左空白: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--左余白")),
        };
    });
    for (const [名称, 方向] of Object.entries({
        導入: 組版方向.導入, 章題: 組版方向.章題, 手順: 組版方向.手順,
        個別: 組版方向.個別, 物語: 組版方向.物語, 主題: 組版方向.主題,
    })) {
        const 数 = 名称 === "章題" ? 3 : 名称 === "手順" ? 2 : 1;
        if (方向.length !== 数 || !方向.every((向き) => 向き === "vertical-rl")) {
            throw new Error("縦書きの案内が不正です: " + JSON.stringify({ 名称, 方向, 数 }));
        }
    }
    if (!組版方向.書体.includes("Yu Mincho") || 組版方向.足方向 !== "vertical-rl"
        || 組版方向.頭方向 !== "vertical-rl"
        || 組版方向.頭右 !== 組版方向.画面幅
        || 組版方向.足左 !== 組版方向.足左空白
        || 組版方向.足左空白 < 5
        || Math.abs(組版方向.支援下 - 組版方向.画面高) > 1
        || Math.abs(組版方向.支援上 - 組版方向.頭下) > 1
        || await 頁.locator(".物語注記").count() !== 0) {
        throw new Error("左右の縦書き軌道と書体が不正です: " + JSON.stringify(組版方向));
    }
    const 軌道の寸法 = await 頁.evaluate(() => {
        const 計測 = (軌道: string, 項目: string): Readonly<{
            内幅: number; 使用幅: number; 位置: readonly number[];
            収まり: boolean;
        }> => {
            const 面 = document.querySelector(軌道);
            if (!面) throw new Error("軌道が存在しません: " + 軌道);
            const 枠 = 面.getBoundingClientRect();
            const 子 = Array.from(面.querySelectorAll(項目));
            const 位置 = 子.map((要素) => {
                const 箱 = 要素.getBoundingClientRect();
                return (箱.left + 箱.right) / 2;
            });
            const 収まり = 子.every((要素) => {
                const 箱 = 要素.getBoundingClientRect();
                return 箱.left >= 枠.left - 2 && 箱.right <= 枠.right + 2;
            });
            return { 内幅: 面.clientWidth, 使用幅: 面.scrollWidth, 位置, 収まり };
        };
        return {
            頭: 計測(".上部中", ".印, nav a, #配色切替"),
            足: 計測(".下部中", ".下部版, .下部リンク a"),
            頭案内: 計測(".上部 nav", "a, #配色切替"),
            足案内: 計測(".下部リンク", "a"),
            横はみ出し: document.documentElement.scrollWidth - window.innerWidth,
        };
    });
    const 頭の並び = 軌道の寸法.頭案内.位置;
    const 足の並び = 軌道の寸法.足案内.位置;
    if (!軌道の寸法.頭.収まり || !軌道の寸法.足.収まり
        || !軌道の寸法.頭案内.収まり || !軌道の寸法.足案内.収まり
        || 軌道の寸法.頭.使用幅 > 軌道の寸法.頭.内幅 + 2
        || 軌道の寸法.足.使用幅 > 軌道の寸法.足.内幅 + 2
        || Math.max(...頭の並び) - Math.min(...頭の並び) > 4
        || Math.max(...足の並び) - Math.min(...足の並び) > 4
        || 軌道の寸法.横はみ出し > 3) {
        throw new Error("一列の縦書き軌道が横に溢れています: " + JSON.stringify(軌道の寸法));
    }

    for (const 名称 of ["組版", "合成", "書式"]) {
        const 配置 = await 頁.locator("#" + 名称).evaluate((節) => {
            const 題 = 節.querySelector(".節題")?.getBoundingClientRect();
            const 本文 = 節.querySelector(".機能格子, .作品格子, .手順")?.getBoundingClientRect();
            return { 題左: 題?.left ?? 0, 本文右: 本文?.right ?? 0 };
        });
        if (配置.題左 < 配置.本文右) {
            throw new Error("右側の縦書き見出しが本文に重なっています: " + JSON.stringify({ 名称, 配置 }));
        }
    }
    const 章の見出し = 頁.locator(".物語冒頭 h2");
    if (await 章の見出し.count() !== 1
        || await 章の見出し.textContent() !== "日本語の物語と縦書きの実例"
        || await 頁.locator(".物語冒頭 p, .物語冒頭 .物語説明").count() !== 0) {
        throw new Error("物語の導入には一つの縦書き見出しだけを表示します");
    }

    const 物語配置 = await 頁.locator(".物語節 .容器").evaluate((箱) => {
        const 題 = 箱.querySelector(".物語冒頭")?.getBoundingClientRect();
        const 本文 = 箱.querySelector(".物語読書面")?.getBoundingClientRect();
        return { 題左: 題?.left ?? 0, 本文右: 本文?.right ?? 0 };
    });
    if (物語配置.題左 - 物語配置.本文右 < 32) {
        throw new Error("物語の縦書き案内が巻物に重なっています: " + JSON.stringify(物語配置));
    }

    // 広い画面は右から主題・言の葉・案内の順。左右に罫線を引く。
    for (const 横幅 of [1280, 1024]) {
        await 頁.setViewportSize({ width: 横幅, height: 800 });
        const 主題配置 = await 頁.locator(".主題").evaluate((主題) => {
            const 案内 = 主題.querySelector(".主題縦案内");
            const 見本 = 主題.querySelector(".主題見本");
            const 見出し = 主題.querySelector(".主題見出し");
            if (!案内 || !見本 || !見出し) throw new Error("主題の三領域がありません");
            const 左 = 案内.getBoundingClientRect();
            const 中 = 見本.getBoundingClientRect();
            const 右 = 見出し.getBoundingClientRect();
            const 線 = getComputedStyle(見本);
            return {
                左右: 左.right, 中左: 中.left, 中右: 中.right, 右左: 右.left,
                左幅: 左.width, 中幅: 中.width, 右幅: 右.width,
                左線: Number.parseFloat(線.borderLeftWidth),
                右線: Number.parseFloat(線.borderRightWidth),
                書体: getComputedStyle(見出し.querySelector(".綴り-縦書")!).writingMode,
                表題: 見出し.textContent,
                見本: 見本.textContent,
                操作数: 案内.querySelectorAll(".導入行 a").length,
                主題幅: 主題.getBoundingClientRect().width,
            };
        });
        if (主題配置.左幅 < 110 || 主題配置.中幅 < 110 || 主題配置.右幅 < 105
            || 主題配置.左右 > 主題配置.中左 - 8
            || 主題配置.中右 > 主題配置.右左 - 8
            || 主題配置.左線 < 1 || 主題配置.右線 < 1
            || 主題配置.書体 !== "vertical-rl"
            || !主題配置.表題?.includes("文字を")
            || !主題配置.見本?.includes("言の葉を")
            || 主題配置.操作数 !== 2) {
            throw new Error("三領域の主題が正しい順に並んでいません: "
                + JSON.stringify({ 横幅, ...主題配置 }));
        }
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });

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


    const 車輪対象 = 頁.locator("#物語本文");
    await 車輪対象.scrollIntoViewIfNeeded();
    await 車輪対象.evaluate((要素) => { 要素.scrollTo({ left: 0, behavior: "instant" }); });
    const 車輪幅 = await 車輪対象.evaluate((要素) => 要素.scrollWidth - 要素.clientWidth);
    if (車輪幅 < 400) throw new Error("物語に横スクロールの余地がありません");
    await 車輪対象.hover({ position: { x: 35, y: 35 } });
    const 車輪前の縦位置 = await 頁.evaluate(() => window.scrollY);
    await 頁.mouse.wheel(0, 360);
    await 頁.waitForFunction(() => (document.querySelector("#物語本文")?.scrollLeft ?? 0) < -180);
    const 左へ = await 車輪対象.evaluate((要素) => 要素.scrollLeft);
    const 車輪後の縦位置 = await 頁.evaluate(() => window.scrollY);
    if (Math.abs(車輪後の縦位置 - 車輪前の縦位置) > 2) {
        throw new Error("物語を読んでいる間にページが縦に動きました");
    }
    await 頁.mouse.wheel(0, -200);
    await 頁.waitForFunction((以前: number) =>
        (document.querySelector("#物語本文")?.scrollLeft ?? Number.NEGATIVE_INFINITY) > 以前 + 80,
        左へ);
    const 右へ = await 車輪対象.evaluate((要素) => 要素.scrollLeft);
    if (右へ >= 0 || 右へ <= 左へ) {
        throw new Error("車輪を上へ回しても物語が右へ戻りません: "
            + JSON.stringify({ 左へ, 右へ }));
    }
    const 端の検査 = await 車輪対象.evaluate((要素) => {
        要素.scrollTo({ left: 要素.clientWidth - 要素.scrollWidth, behavior: "instant" });
        const 下向き = new WheelEvent("wheel", { deltaY: 240, bubbles: true, cancelable: true });
        const 左端で許可 = 要素.dispatchEvent(下向き);
        要素.scrollTo({ left: 0, behavior: "instant" });
        const 上向き = new WheelEvent("wheel", { deltaY: -240, bubbles: true, cancelable: true });
        const 右端で許可 = 要素.dispatchEvent(上向き);
        const 拡大 = new WheelEvent("wheel", { deltaY: 240, ctrlKey: true, bubbles: true, cancelable: true });
        const 拡大許可 = 要素.dispatchEvent(拡大);
        const 横向き = new WheelEvent("wheel", { deltaX: 320, deltaY: 30, bubbles: true, cancelable: true });
        const 横移動許可 = 要素.dispatchEvent(横向き);
        return { 左端で許可, 右端で許可, 拡大許可, 横移動許可 };
    });
    if (!端の検査.左端で許可 || !端の検査.右端で許可
        || !端の検査.拡大許可 || !端の検査.横移動許可) {
        throw new Error("巻物の端や拡大操作で通常の車輪操作を妨げています: "
            + JSON.stringify(端の検査));
    }

    const 読書面 = 頁.locator(".物語読書面");
    const 目次側 = 頁.locator(".目次側");
    const 引手 = 頁.locator("#目次引手");
    const 固定 = 頁.locator("#目次固定");
    const 初期収納 = await 目次側.evaluate((要素) => ({
        左: 要素.getBoundingClientRect().left,
        親右: 要素.parentElement?.getBoundingClientRect().right ?? 0,
    }));
    if (await 読書面.getAttribute("data-index-pinned") !== "false"
        || Math.abs(初期収納.親右 - 初期収納.左 - 34) > 5) {
        throw new Error("目次が初期状態で収納されていません: " + JSON.stringify(初期収納));
    }
    await 引手.hover();

    await 頁.waitForFunction(() =>
        document.querySelector(".目次側")?.getBoundingClientRect().width !== undefined
        && Math.abs((document.querySelector(".目次側")?.getBoundingClientRect().right ?? 0)
            - (document.querySelector(".物語読書面")?.getBoundingClientRect().right ?? 0)) < 5);
    await 頁.mouse.move(5, 5);
    await 頁.waitForTimeout(600);
    const 収納時の幅 = await 頁.locator(".物語読書面").evaluate((面) => {
        const 本文 = 面.querySelector(".物語巻");
        const 引手 = 面.querySelector(".目次引手");
        const 本文枠 = 本文?.getBoundingClientRect();
        const 引手枠 = 引手?.getBoundingClientRect();
        return {
            面: 面.getBoundingClientRect().width,
            本文: 本文枠?.width ?? 0,
            右余白: 本文 ? Number.parseFloat(getComputedStyle(本文).paddingRight) : 0,
            引手左: 引手枠?.left ?? 0,
            本文右: 本文枠?.right ?? 0,
            収納幅: Number.parseFloat(getComputedStyle(面).getPropertyValue("--目次引手幅")),
            隙間: Number.parseFloat(getComputedStyle(面).getPropertyValue("--目次隙間")),
        };
    });
    if (収納時の幅.引手左 - 収納時の幅.本文右 < 10
        || Math.abs(収納時の幅.面 - 収納時の幅.本文
            - 収納時の幅.収納幅 - 収納時の幅.隙間) > 3) {
        throw new Error("収納中の目次がスクロールバーを覆っています: " + JSON.stringify(収納時の幅));
    }
    await 固定.click();
    if (await 固定.getAttribute("aria-pressed") !== "true"
        || await 頁.evaluate(() => localStorage.getItem("綴り-物語目次固定")) !== "true") {
        throw new Error("目次の固定状態が保存されませんでした");
    }
    await 頁.mouse.move(5, 5);
    const 固定後 = await 目次側.evaluate((要素) => ({
        右: 要素.getBoundingClientRect().right,
        親右: 要素.parentElement?.getBoundingClientRect().right ?? 0,
    }));
    if (Math.abs(固定後.親右 - 固定後.右) > 5) {
        throw new Error("固定された目次が閉じています: " + JSON.stringify(固定後));
    }


    await 頁.waitForFunction(() => {
        const 読書面 = document.querySelector(".物語読書面");
        const 本文 = document.querySelector(".物語読書面 .物語巻");
        const 側帯 = document.querySelector(".物語読書面 .目次側");
        if (!読書面 || !本文 || !側帯) return false;
        const 左 = 本文.getBoundingClientRect();
        const 右 = 側帯.getBoundingClientRect();
        return Math.abs(左.right - 右.left) < 3
            && Math.abs(左.width + 右.width - 読書面.getBoundingClientRect().width) < 3;
    });
    const 固定寸法 = await 頁.locator(".物語読書面").evaluate((面) => {
        const 内容 = 面.querySelector(".物語巻");
        const 本文 = 内容?.getBoundingClientRect();
        const 側 = 面.querySelector(".目次側")?.getBoundingClientRect();
        return { 全幅: 面.getBoundingClientRect().width,
            本文右: 本文?.right ?? 0, 目次左: 側?.left ?? 0,
            本文幅: 本文?.width ?? 0, 目次幅: 側?.width ?? 0,
            右余白: 内容 ? Number.parseFloat(getComputedStyle(内容).paddingRight) : 0 };
    });
    if (Math.abs(固定寸法.本文右 - 固定寸法.目次左) > 3
        || Math.abs(固定寸法.本文幅 + 固定寸法.目次幅 - 固定寸法.全幅) > 3
        || 固定寸法.右余白 < 収納時の幅.右余白 + 12) {
        throw new Error("固定した目次と本文の間隔が不足しています: " + JSON.stringify({ 収納時の幅, 固定寸法 }));
    }

    const ルビ位置 = await 頁.locator(".物語巻 .綴り-合成ルビ").evaluateAll((要素一覧) =>
        要素一覧.map((ルビ) => {
            const 字 = ルビ.querySelector(".綴り-文字");
            const 読み = ルビ.querySelector("rt");
            const 字枠 = 字?.getBoundingClientRect();
            const 読み枠 = 読み?.getBoundingClientRect();
            return {
                名: 読み?.textContent ?? "",
                字右: 字枠?.right ?? 0, 読み左: 読み枠?.left ?? 0,
                字中央: 字枠 ? (字枠.top + 字枠.bottom) / 2 : 0,
                読み中央: 読み枠 ? (読み枠.top + 読み枠.bottom) / 2 : 0,
                向き: getComputedStyle(ルビ).writingMode,
                間隔: Number.parseFloat(getComputedStyle(ルビ).gap),
                文字大きさ: Number.parseFloat(getComputedStyle(ルビ).fontSize),
            };
        })
    );
    if (ルビ位置.length < 4 || !ルビ位置.some((位置) => 位置.名 === "しらはぎ")) {
        throw new Error("合成漢字の振仮名が確認できません: " + JSON.stringify(ルビ位置));
    }
    for (const 位置 of ルビ位置) {
        if (位置.向き !== "vertical-rl" || 位置.読み左 - 位置.字右 < 1
            || 位置.読み左 - 位置.字右 > 8
            || 位置.間隔 > 位置.文字大きさ * .11
            || Math.abs(位置.読み中央 - 位置.字中央) > 18) {
            throw new Error("合成漢字と振仮名が重なっています: " + JSON.stringify(位置));
        }
    }

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
    if (await 頁.locator("#目次固定").getAttribute("aria-pressed") !== "true"
        || await 頁.locator(".物語読書面").getAttribute("data-index-pinned") !== "true") {
        throw new Error("再読込後に目次の固定が復元されませんでした");
    }
    await 頁.locator("#目次固定").click();
    if (await 頁.evaluate(() => localStorage.getItem("綴り-物語目次固定")) !== "false") {
        throw new Error("目次の固定解除が保存されませんでした");
    }

    await 頁.locator("#物語本文").focus();
    await 頁.mouse.move(5, 5);
    await 頁.waitForTimeout(600);
    const 解除後の余白 = await 頁.locator(".物語読書面").evaluate((面) => {
        const 本文 = 面.querySelector(".物語巻")?.getBoundingClientRect();
        const 引手 = 面.querySelector(".目次引手")?.getBoundingClientRect();
        const 側 = 面.querySelector(".目次側")?.getBoundingClientRect();
        return {
            隙間: (引手?.left ?? 0) - (本文?.right ?? 0),
            側面: (面.getBoundingClientRect().right - (側?.left ?? 0)),
            固定: 面.getAttribute("data-index-pinned"),
        };
    });
    if (解除後の余白.隙間 < 10 || Math.abs(解除後の余白.側面 - 34) > 5) {
        throw new Error("固定解除後に目次の余白が保たれていません: " + JSON.stringify(解除後の余白));
    }

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

    // 携帯の Ko-fi は外部の円形ウィジェットではなく、縦書きの固定案内を使用する。
    await 頁.setViewportSize({ width: 390, height: 840 });
    const 携帯の軌道 = await 頁.evaluate(() => {
        const 頭 = document.querySelector(".上部")?.getBoundingClientRect();
        const 足 = document.querySelector(".下部")?.getBoundingClientRect();
        const 見出し = document.querySelector(".縦案内節 .節題")?.getBoundingClientRect();
        return { 画面幅: innerWidth, はみ出し: document.documentElement.scrollWidth - innerWidth,
            頭右: 頭?.right ?? 0, 足左: 足?.left ?? 0, 見出し右: 見出し?.right ?? 0 };
    });
    if (携帯の軌道.頭右 !== 携帯の軌道.画面幅 || 携帯の軌道.足左 < 5
        || 携帯の軌道.はみ出し > 3 || 携帯の軌道.見出し右 > 携帯の軌道.頭右) {
        throw new Error("携帯の縦組が画面に収まりません: " + JSON.stringify(携帯の軌道));
    }

    const 携帯の欄 = await 頁.evaluate(() => {
        const 測定 = (要素: string, 子: string) => {
            const 本体 = document.querySelector(要素);
            const 項目 = Array.from(document.querySelectorAll(子));
            const 枠 = 本体?.getBoundingClientRect();
            return {
                幅: 本体?.clientWidth ?? 0,
                使用幅: 本体?.scrollWidth ?? 0,
                収まり: Boolean(枠 && 項目.every((項) => {
                    const 個 = 項.getBoundingClientRect();
                    return 個.left >= 枠.left - 2 && 個.right <= 枠.right + 2;
                })),
            };
        };
        const 書面 = document.querySelector(".物語節 .容器");
        const 題 = 書面?.querySelector(".物語冒頭")?.getBoundingClientRect();
        const 本文 = 書面?.querySelector(".物語読書面")?.getBoundingClientRect();
        return {
            頭: 測定(".上部中", ".上部 .印, .上部 nav a, .上部 #配色切替"),
            足: 測定(".下部中", ".下部 .下部版, .下部 .下部リンク a"),
            主題: getComputedStyle(document.querySelector(".主題見出し > .綴り-縦書")!).writingMode,
            物語上下間隔: (本文?.top ?? 0) - (題?.bottom ?? 0),
        };
    });
    if (!携帯の欄.頭.収まり || !携帯の欄.足.収まり
        || 携帯の欄.頭.使用幅 > 携帯の欄.頭.幅 + 2
        || 携帯の欄.足.使用幅 > 携帯の欄.足.幅 + 2
        || 携帯の欄.主題 !== "vertical-rl" || 携帯の欄.物語上下間隔 < 12) {
        throw new Error("携帯表示の縦組と余白が不正です: " + JSON.stringify(携帯の欄));
    }

    const 携帯収納 = await 頁.locator(".物語読書面").evaluate((面) => {
        const 本文 = 面.querySelector(".物語巻")?.getBoundingClientRect();
        const 引手 = 面.querySelector(".目次引手")?.getBoundingClientRect();
        return { 本文右: 本文?.right ?? 0, 引手左: 引手?.left ?? 0 };
    });
    if (携帯収納.引手左 - 携帯収納.本文右 < 10) {
        throw new Error("携帯画面で目次がスクロールバーを隠しています: " + JSON.stringify(携帯収納));
    }
    const 携帯支援 = await 頁.locator(".支援側帯").evaluate((要素) => {
        const 箱 = 要素.getBoundingClientRect();
        const 頭 = document.querySelector(".上部")?.getBoundingClientRect();
        const 表示 = getComputedStyle(要素);
        return {
            表示: 表示.display,
            向き: getComputedStyle(要素.querySelector(".綴り-縦書")!).writingMode,
            右: 箱.right, 下: 箱.bottom, 上: 箱.top,
            頭下: 頭?.bottom ?? 0,
            高さ: 箱.height,
        };
    });
    if (携帯支援.表示 === "none" || 携帯支援.向き !== "vertical-rl"
        || Math.abs(携帯支援.右 - 390) > 2 || Math.abs(携帯支援.下 - 840) > 2
        || Math.abs(携帯支援.上 - 携帯支援.頭下) > 2
        || await 頁.locator(".支援浮輪").count() !== 0
        || await 頁.locator('script[data-kofi-script="true"]').count() !== 0) {
        throw new Error("携帯用の縦書き珈琲案内が不正です: " + JSON.stringify(携帯支援));
    }

    // 本文は左右の固定欄に入り込まず、見出しと本文は別段に置かれる。
    for (const 横幅 of [375, 390, 430, 320]) {
        await 頁.setViewportSize({ width: 横幅, height: 840 });
        const 配置 = await 頁.evaluate(() => {
            const 根 = document.documentElement;
            const 頭 = document.querySelector(".上部")?.getBoundingClientRect();
            const 足 = document.querySelector(".下部")?.getBoundingClientRect();
            const 見出し = document.querySelector(".主題見出し")?.getBoundingClientRect();
            const 主題 = document.querySelector(".主題")?.getBoundingClientRect();
            const 左端 = 足?.right ?? 0;
            const 右端 = 頭?.left ?? innerWidth;
            const 選択 = [
                ".主題見出し", ".主題縦案内", ".主題見本",
                ".縦案内節 > .節題", ".縦案内節 .機能",
                ".縦案内節 .作品", ".縦案内節 .手順 article",
                ".縦案内節 .一覧", ".縦案内節 .一覧格子",
                ".物語冒頭", ".物語読書面",
            ];
            const 範囲 = 選択.flatMap((式) => Array.from(document.querySelectorAll(式), (要素) => ({
                要素: 式, 左: 要素.getBoundingClientRect().left,
                右: 要素.getBoundingClientRect().right,
            })));
            const 重なり = Array.from(document.querySelectorAll(".縦案内節"), (節) => {
                const 題 = 節.querySelector(".節題")?.getBoundingClientRect();
                const 本文 = 節.querySelector(".機能格子, .作品格子, .手順")?.getBoundingClientRect();
                return { 差: (本文?.top ?? 0) - (題?.bottom ?? 0) };
            });
            const 手順 = Array.from(document.querySelectorAll(".手順 article"), (記事) => {
                const 文 = 記事.querySelector("pre")?.getBoundingClientRect();
                const 題 = 記事.querySelector(".手順題")?.getBoundingClientRect();
                return { 間隔: (題?.left ?? 0) - (文?.right ?? 0) };
            });
            const 一覧 = document.querySelector(".一覧")?.getBoundingClientRect();
            const 配布 = document.querySelector(".一覧格子")?.getBoundingClientRect();
            return {
                窓幅: innerWidth,
                超過幅: 根.scrollWidth - 根.clientWidth,
                左端, 右端, 主題幅: 主題?.width ?? 0,
                主題中心差: ((見出し?.left ?? 0) + (見出し?.right ?? 0)) / 2
                    - (左端 + 右端) / 2,
                範囲, 重なり, 手順,
                一覧内: Boolean(一覧 && 配布 && 配布.left >= 一覧.left - 1
                    && 配布.right <= 一覧.right + 1
                    && 配布.top >= 一覧.top - 1
                    && 配布.bottom <= 一覧.bottom + 1),
            };
        });
        const はみ出し = 配置.範囲.filter((項目) =>
            項目.左 < 配置.左端 - 2 || 項目.右 > 配置.右端 + 2
        );
        if (配置.超過幅 > 2 || はみ出し.length > 0
            || Math.abs(配置.主題中心差) > 22
            || 配置.重なり.some((項目) => 項目.差 < 12)
            || 配置.手順.some((項目) => 項目.間隔 < 2)
            || !配置.一覧内) {
            throw new Error("携帯表示が欄外へ溢れたり内容を重ねています: "
                + JSON.stringify({ 横幅, ...配置, はみ出し }));
        }
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });
    console.log("実ブラウザーでの表示検査に合格しました。");
} finally {
    await ブラウザー.close();
    配信.stop();
}

