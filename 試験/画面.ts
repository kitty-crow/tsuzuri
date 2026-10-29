import { chromium } from "playwright";

const 公開版 = (await Bun.file("package.json").json() as { readonly version: string }).version;

const 配信 = Bun.serve({
    port: 0,
    fetch(要求) {
        const 道 = decodeURIComponent(new URL(要求.url).pathname);
        const 対象 = 道 === "/" ? "index.html" : 道.replace(/^\//, "");
        if (!["index.html", "綴.svg", "様式.css", "物語.css", "朗読.css", "支援.css", "配色.js", "目次.js", "朗読.js", "音声SDK.js", "dist/tsuzuri.js", "dist/tsuzuri.css", "dist/tsuzuri.js.map"].includes(対象)) {
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
    // 新しい二種類の記法と従来の文字構造が同じ結果になることを確かめる。
    await 頁.evaluate(() => {
        const 箱 = document.createElement("div");
        箱.id = "新書式検査";
        箱.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
        箱.innerHTML = `
          <t-綴><span id="和左右"><t-漢字 横 振り="つづり">綴り</t-漢字></span></t-綴>
          <tsuzuri><span id="羅左右"><kanji horizontal reading="つづり">綴り</kanji></span></tsuzuri>
          <t-綴><span id="和上下"><t-漢字 縦>日本</t-漢字></span></t-綴>
          <tsuzuri><span id="羅上下"><kanji vertical>日本</kanji></span></tsuzuri>
          <t-綴><span id="和入子"><t-漢字 縦>
            <t-漢字 横>日本</t-漢字>
            <t-漢字 横>綴り</t-漢字>
          </t-漢字></span></t-綴>
          <tsuzuri><span id="羅入子"><kanji vertical>
            <kanji horizontal>日本</kanji>
            <kanji horizontal>綴り</kanji>
          </kanji></span></tsuzuri>
          <tsuzuri><span id="表意"><kanji>⿱⿰日本⿰綴り</kanji></span></tsuzuri>
          <t-綴><span id="和読み"><t-振り 読み="ことば">言葉</t-振り>
            <t-漢字 振り="ことば">言葉</t-漢字></span></t-綴>
          <tsuzuri><span id="羅読み"><furigana reading="ことば">言葉</furigana>
            <kanji reading="ことば">言葉</kanji></span></tsuzuri>
          <tsuzuri><span id="非合成"><kanji>日本</kanji></span></tsuzuri>
          <tsuzuri><span id="旧来"><jp-kanji>日本</jp-kanji></span></tsuzuri>
          <t-綴 横><span id="和方向"><t-縦>縦書き</t-縦><t-横>横書き</t-横></span></t-綴>
          <tsuzuri horizontal><span id="羅方向"><tategaki>縦書き</tategaki><yokogaki>横書き</yokogaki></span></tsuzuri>
          <t-綴 縦><span id="和明示">縦書き</span></t-綴>
          <tsuzuri vertical><span id="羅明示">縦書き</span></tsuzuri>
          <t-綴><span id="和追加"><t-漢数字 値="2026"></t-漢数字>
            <t-暦 日付="2026-10-28"></t-暦><t-組版>文章</t-組版>
            <t-縦中横>25</t-縦中横></span></t-綴>
          <tsuzuri><span id="羅追加"><kansuji value="2026"></kansuji>
            <koyomi date="2026-10-28"></koyomi><kumihan>文章</kumihan>
            <tcy>25</tcy></span></tsuzuri>
          <span id="範囲外"><kanji horizontal>日本</kanji></span>
        `;
        document.body.append(箱);
    });
    await 頁.waitForFunction(() =>
        document.querySelectorAll("#新書式検査 .綴り-原字").length >= 8
        && !document.querySelector("#和追加 t-漢数字")
        && !document.querySelector("#羅追加 kansuji"));
    const 新書式 = await 頁.locator("#新書式検査").evaluate((箱) => {
        const 参照 = (名: string): Element => {
            const 要素 = 箱.querySelector("#" + 名);
            if (!要素) throw new Error("検査対象が見つかりません: " + 名);
            return 要素;
        };
        const 原文 = (名: string): string =>
            参照(名).querySelector(".綴り-原字")?.textContent ?? "";
        const 読み = (名: string): string[] =>
            Array.from(参照(名).querySelectorAll("rt"), (要素) => 要素.textContent ?? "");
        const 方向 = (名: string, 種: string): string =>
            getComputedStyle(参照(名).querySelector(種)!).writingMode;
        return {
            和左右: 原文("和左右"), 羅左右: 原文("羅左右"),
            和上下: 原文("和上下"), 羅上下: 原文("羅上下"),
            和入子: 原文("和入子"), 羅入子: 原文("羅入子"), 表意: 原文("表意"),
            入子部品: 参照("和入子").querySelectorAll(".綴り-単字").length,
            和左右読み: 読み("和左右"), 羅左右読み: 読み("羅左右"),
            和読み: 読み("和読み"), 羅読み: 読み("羅読み"),
            普通は非合成: !参照("非合成").querySelector(".綴り-原字"),
            旧来: 原文("旧来"),
            和横書: getComputedStyle(参照("和方向").parentElement!).writingMode,
            羅横書: getComputedStyle(参照("羅方向").parentElement!).writingMode,
            和縦領域: 方向("和方向", ".綴り-縦書"),
            羅縦領域: 方向("羅方向", ".綴り-縦書"),
            和横領域: 方向("和方向", ".綴り-横書"),
            羅横領域: 方向("羅方向", ".綴り-横書"),
            和明示: getComputedStyle(参照("和明示").parentElement!).writingMode,
            羅明示: getComputedStyle(参照("羅明示").parentElement!).writingMode,
            和追加: 参照("和追加").textContent?.replace(/\s+/g, "") ?? "",
            羅追加: 参照("羅追加").textContent?.replace(/\s+/g, "") ?? "",
            和縦中横: Boolean(参照("和追加").querySelector(".綴り-縦中横")),
            羅縦中横: Boolean(参照("羅追加").querySelector(".綴り-縦中横")),
            範囲外: 参照("範囲外").querySelector("kanji") !== null,
        };
    });
    if (新書式.和左右 !== "⿰綴り" || 新書式.羅左右 !== "⿰綴り"
        || 新書式.和上下 !== "⿱日本" || 新書式.羅上下 !== "⿱日本"
        || 新書式.和入子 !== "⿱⿰日本⿰綴り" || 新書式.羅入子 !== "⿱⿰日本⿰綴り"
        || 新書式.表意 !== 新書式.和入子 || 新書式.入子部品 !== 4
        || 新書式.和左右読み.join("") !== "つづり"
        || 新書式.羅左右読み.join("") !== "つづり"
        || 新書式.和読み.join(",") !== "ことば,ことば"
        || 新書式.羅読み.join(",") !== "ことば,ことば"
        || !新書式.普通は非合成 || 新書式.旧来 !== "⿱日本"
        || 新書式.和横書 !== "horizontal-tb" || 新書式.羅横書 !== "horizontal-tb"
        || 新書式.和縦領域 !== "vertical-rl" || 新書式.羅縦領域 !== "vertical-rl"
        || 新書式.和横領域 !== "horizontal-tb" || 新書式.羅横領域 !== "horizontal-tb"
        || 新書式.和明示 !== "vertical-rl" || 新書式.羅明示 !== "vertical-rl"
        || 新書式.和追加 !== 新書式.羅追加
        || !新書式.和縦中横 || !新書式.羅縦中横 || !新書式.範囲外) {
        throw new Error("日本語とローマ字の新書式が一致しません: " + JSON.stringify(新書式));
    }
    await 頁.evaluate(() => document.querySelector("#新書式検査")?.remove());

    // 紹介ページの見本は日本語の記法だけを使い、ローマ字の対応は別表にする。
    const 記法見本 = await 頁.locator("#書式").evaluate((節) => ({
        行数: 節.querySelectorAll(".記法対応 tbody tr").length,
        見出し: Array.from(節.querySelectorAll(".記法対応 thead th"), (欄) => 欄.textContent),
        一行目: Array.from(節.querySelectorAll(".記法対応 tbody tr:first-child > *"), (欄) => 欄.textContent),
        最終行: Array.from(節.querySelectorAll(".記法対応 tbody tr:last-child > *"), (欄) => 欄.textContent),
        実例: 節.querySelector(".手順 article:nth-child(2) code")?.textContent ?? "",
        説明: 節.querySelector(".記法対応 p")?.textContent ?? "",
        縦題: 節.querySelector(".記法題 h3")?.textContent ?? "",
        縦本文: Boolean(節.querySelector(".記法題 > .綴り-縦書")),
    }));
    const 合成見本 = await 頁.locator(".作品格子").evaluate((節) =>
        Array.from(節.querySelectorAll(".文字列 code"), (欄) => 欄.textContent ?? ""));
    if (記法見本.行数 !== 9 || 記法見本.見出し.join(",") !== "用途,日本語,ローマ字"
        || 記法見本.一行目.join(",") !== "処理領域,t-綴,tsuzuri"
        || 記法見本.最終行.join(",") !== '振仮名の読み,読み="...",reading="..."'
        || !記法見本.実例.includes("<t-綴>")
        || 記法見本.実例.includes("<jp-") || !記法見本.説明.includes("ローマ字")
        || 記法見本.縦題 !== "ローマ字の記法にも対応" || !記法見本.縦本文
        || 合成見本.length !== 4
        || !合成見本.every((見本) => 見本.includes("<t-漢字"))
        || 合成見本.some((見本) => 見本.includes("<kanji"))) {
        throw new Error("紹介ページの日本語見本とローマ字の対応表が不正です: "
            + JSON.stringify({ 記法見本, 合成見本 }));
    }

    // 対照表の説明は右側で縦組になり、罫線で左側の表と区切られる。
    for (const 横幅 of [1280, 1024, 820]) {
        await 頁.setViewportSize({ width: 横幅, height: 800 });
        const 対照配置 = await 頁.locator(".記法対応").evaluate((箱) => {
            const 表 = 箱.querySelector(".記法表枠");
            const 説明 = 箱.querySelector(".記法題");
            const 縦組 = 説明?.querySelector(".綴り-縦書");
            const 表枠 = 表?.getBoundingClientRect();
            const 右枠 = 説明?.getBoundingClientRect();
            const 外枠 = 箱.getBoundingClientRect();
            return {
                外左: 外枠.left, 外右: 外枠.right,
                表右: 表枠?.right ?? 0,
                説明左: 右枠?.left ?? 0,
                説明右: 右枠?.right ?? 0,
                罫線: 説明 ? getComputedStyle(説明).borderLeftStyle : "",
                罫線幅: 説明 ? getComputedStyle(説明).borderLeftWidth : "",
                縦組: 縦組 ? getComputedStyle(縦組).writingMode : "",
                高さ: 縦組?.getBoundingClientRect().height ?? 0,
                表の中: Boolean(表枠 && 表枠.left >= 外枠.left - 1),
            };
        });
        if (!対照配置.表の中 || 対照配置.表右 > 対照配置.説明左 - 10
            || 対照配置.説明右 > 対照配置.外右 + 1
            || 対照配置.罫線 !== "solid" || 対照配置.罫線幅 !== "1px"
            || 対照配置.縦組 !== "vertical-rl" || 対照配置.高さ < 250) {
            throw new Error("対照表の縦書き案内と罫線が不正です: "
                + JSON.stringify({ 横幅, ...対照配置 }));
        }
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });

    // 活用語尾は振仮名に含めず、文字の外側へ続ける。
    const 活用の読み = await 頁.locator(".機能 .大文字").evaluate((要素) => ({
        読み: Array.from(要素.querySelectorAll("ruby"), (ルビ) => ({
            親字: Array.from(ルビ.childNodes)
                .filter((節) => 節.nodeType === Node.TEXT_NODE)
                .map((節) => 節.textContent ?? "").join(""),
            振り: ルビ.querySelector("rt")?.textContent ?? "",
        })),
        本文: 要素.textContent ?? "",
    }));
    if (活用の読み.読み.length !== 2
        || 活用の読み.読み[1]?.親字 !== "綴"
        || 活用の読み.読み[1]?.振り !== "つづ"
        || !活用の読み.本文.endsWith("る。")) {
        throw new Error("活用語尾と振仮名の対応が不正です: " + JSON.stringify(活用の読み));
    }

    // 合成字の振仮名は小さくし、上下合成の読みを字の右へ置く。
    const 合成の読み = await 頁.locator(".作品格子 .作品見本").evaluateAll((要素一覧) =>
        要素一覧.map((箱) => {
            const 合成 = 箱.querySelector(".綴り-文字");
            const ルビ = 箱.querySelector(".綴り-合成ルビ");
            const 読み = ルビ?.querySelector("rt");
            const 字枠 = 合成?.getBoundingClientRect();
            const 読み枠 = 読み?.getBoundingClientRect();
            const 方向 = ルビ ? getComputedStyle(ルビ).writingMode : "";
            return {
                縦: 箱.classList.contains("作品見本-縦"),
                読み: 読み?.textContent ?? "",
                文字大きさ: ルビ ? Number.parseFloat(getComputedStyle(ルビ).fontSize) : 0,
                読み大きさ: 読み ? Number.parseFloat(getComputedStyle(読み).fontSize) : 0,
                右間隔: 字枠 && 読み枠 ? 読み枠.left - 字枠.right : -999,
                上間隔: 字枠 && 読み枠 ? 字枠.top - 読み枠.bottom : -999,
                向き: 方向,
            };
        }));
    if (合成の読み.length !== 4
        || 合成の読み.filter((項目) => 項目.縦).length !== 3
        || 合成の読み.some((項目) =>
            !項目.読み || 項目.読み大きさ > 項目.文字大きさ * .22)
        || 合成の読み.some((項目) => 項目.縦
            && (項目.向き !== "vertical-rl" || 項目.右間隔 < 0))
        || 合成の読み.some((項目) => !項目.縦
            && (項目.向き !== "horizontal-tb" || 項目.上間隔 < -1))) {
        throw new Error("合成文字の小さな振仮名の位置が不正です: " + JSON.stringify(合成の読み));
    }

    // 朗読の格納位置は巻物の上。収納時は常に引手の高さだけを占める。
    const 朗読領域 = await 頁.locator(".物語節 > .容器").evaluate((箱) => {
        const 巻 = 箱.querySelector(".物語読書面")?.getBoundingClientRect();
        const 収納 = 箱.querySelector(".朗読収納")?.getBoundingClientRect();
        const 引手 = 箱.querySelector(".朗読看板")?.getBoundingClientRect();
        const 操作 = 箱.querySelector(".朗読内容")?.getBoundingClientRect();
        const 看板 = 箱.querySelector(".朗読看板");
        const 枠線 = 看板 ? getComputedStyle(看板) : null;
        return {
            巻上: 巻?.top ?? 0, 収納下: 収納?.bottom ?? 0,
            収納高: 収納?.height ?? 0, 引手高: 引手?.height ?? 0,
            操作高: 操作?.height ?? -1,
            収納右: 収納?.right ?? 0, 巻右: 巻?.right ?? 0,
            上枠線: 枠線?.borderTopWidth ?? "",
            上枠色: 枠線?.borderTopColor ?? "",
            左枠色: 枠線?.borderLeftColor ?? "",
            上枠種: 枠線?.borderTopStyle ?? "",
        };
    });
    if (Math.abs(朗読領域.巻上 - 朗読領域.収納下) > 1.5
        || 朗読領域.収納高 < 36 || 朗読領域.収納高 > 46
        || 朗読領域.操作高 > 1 || Math.abs(朗読領域.収納右 - 朗読領域.巻右) > 3
        || 朗読領域.上枠線 !== "1px" || 朗読領域.上枠種 !== "solid"
        || 朗読領域.上枠色 !== 朗読領域.左枠色) {
        throw new Error("朗読の収納場所か予約領域が不正です: " + JSON.stringify(朗読領域));
    }

    // 音声モジュールは物語でだけ起動し、音声合成の設定を公開 HTML に埋め込まない。
    const 朗読表示 = 頁.locator(".朗読操作");
    await 頁.waitForSelector("#朗読再生", { state: "attached" });
    await 頁.locator("#朗読引手").hover();
    const 表示確認 = await 朗読表示.evaluate((節) => ({
        状態: 節.querySelector("#朗読状態")?.textContent,
        声: 節.querySelector(".朗読声")?.textContent,
        鍵種: 節.querySelector("#朗読鍵")?.getAttribute("type"),
        設定: (節.querySelector("#朗読設定") as HTMLDetailsElement | null)?.open,
        領域: 節.closest(".容器")?.querySelector(".物語読書面") !== null,
    }));
    if (!表示確認.状態?.includes("準備") || !表示確認.声?.includes("七海")
        || 表示確認.鍵種 !== "password" || !表示確認.領域) {
        throw new Error("物語専用の朗読操作が正しくありません: " + JSON.stringify(表示確認));
    }
    await 頁.locator("#朗読再生").click();
    if (await 頁.locator("#朗読設定").getAttribute("open") === null
        || !((await 頁.locator("#朗読状態").textContent()) ?? "").includes("キー")) {
        throw new Error("Azure のキーがない場合に設定画面を案内していません");
    }
    const 音声設定 = await 頁.evaluate(() => ({
        声: window.readAloudState.voiceName,
        段落数: window.readAloudState.paragraphs.length,
        朗読内容: window.readAloudState.paragraphs.slice(0, 3).map((段落) =>段落.textContent),
    }));
    if (音声設定.声 !== "ja-JP-NanamiNeural" || 音声設定.段落数 < 100
        || !音声設定.朗読内容.some((文章) =>文章?.includes("白萩"))) {
        throw new Error("日本語の女性音声と物語の段落が設定されていません: "
            + JSON.stringify(音声設定));
    }

    // Azure SDK は GitHub Pages の同一生成物から取得できること。
    const SDK配信 = await 頁.evaluate(async () => {
        const 応答 = await fetch("./音声SDK.js");
        const 中身 = await 応答.text();
        const 読込 = await new Promise<boolean>((完了) => {
            const 読込器 = document.createElement("script");
            読込器.src = "./音声SDK.js";
            読込器.onload = () => 完了(Boolean(window.SpeechSDK));
            読込器.onerror = () => 完了(false);
            document.head.append(読込器);
        });
        return {
            状態: 応答.status, 大きさ: 中身.length, 読込,
            同一発行元: new URL("./音声SDK.js", document.baseURI).origin === location.origin,
        };
    });
    if (SDK配信.状態 !== 200 || SDK配信.大きさ < 100_000
        || !SDK配信.読込 || !SDK配信.同一発行元) {
        throw new Error("Azure 音声 SDK がサイトから配信されていません: " + JSON.stringify(SDK配信));
    }

    // ヘッダーは SVG 画像ではなく、綴り自身で合成した「⿰綴り」だけを表示する。
    await 頁.waitForSelector(".上部 .印 .印章 .綴り-文字 .綴り-単字");
    const 標章 = await 頁.locator(".上部 .印 .印章").evaluate((要素) => {
        const 字 = 要素.querySelector(".綴り-文字");
        const 視字 = 要素.querySelector(".綴り-視字");
        const 箱 = 字?.getBoundingClientRect();
        const 枠 = 要素.getBoundingClientRect();
        return {
            元: 要素.querySelector(".綴り-原字")?.textContent ?? "",
            部品: Array.from(視字?.querySelectorAll(".綴り-単字") ?? [], (部) => 部.textContent),
            ルビ数: 要素.querySelectorAll("ruby, rt").length,
            縦組: getComputedStyle(要素.querySelector(".綴り-縦書")!).writingMode,
            枠: getComputedStyle(要素).borderTopStyle,
            枠幅: getComputedStyle(要素).borderTopWidth,
            大きさ: 箱?.width ?? 0,
            枠高さ: 枠.height,
            枠横幅: 枠.width,
            中心差: 箱 ? (箱.left + 箱.right - 枠.left - 枠.right) / 2 : 999,
            縦中心差: 箱 ? (箱.top + 箱.bottom - 枠.top - 枠.bottom) / 2 : 999,
            枠内: Boolean(箱 && 箱.left >= 枠.left && 箱.right <= 枠.right
                && 箱.top >= 枠.top && 箱.bottom <= 枠.bottom),
        };
    });
    const アイコン先 = await 頁.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
    const 標章の原文 = await 頁.evaluate(async () => {
        const 応答 = await fetch("./綴.svg");
        return 応答.ok ? await 応答.text() : "";
    });
    if (標章.元 !== "⿰綴り" || 標章.部品.join("") !== "綴り"
        || 標章.ルビ数 !== 0 || 標章.縦組 !== "vertical-rl"
        || 標章.枠 !== "solid" || 標章.枠幅 !== "1px"
        || 標章.大きさ < 30 || 標章.枠横幅 < 54
        || Math.abs(標章.枠横幅 - 標章.枠高さ) > 1
        || Math.abs(標章.中心差) > 2.5 || Math.abs(標章.縦中心差) > 2.5
        || !標章.枠内 || await 頁.locator(".上部 .印 img").count() !== 0
        || アイコン先 !== "./綴.svg?mark=kanji-only"
        || (標章の原文.match(/<path /g) ?? []).length !== 2
        || !標章の原文.includes('x="8" y="8" width="112" height="112"')
        || !["translate(18 95)", "translate(64 95)"]
            .every((座標) => 標章の原文.includes(座標))
        || 標章の原文.includes("つづり")
        || 標章の原文.includes("<text ") || 標章の原文.includes("<image ")) {
        throw new Error("標章の合成漢字とファビコンが不正です: "
            + JSON.stringify({ 標章, アイコン先 }));
    }

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
    const 単独版の縦並び = await 頁.locator(".一覧格子").evaluate((欄) => {
        const 要素一覧 = Array.from(欄.querySelectorAll("code"), (要素) => 要素.getBoundingClientRect());
        const 様式 = getComputedStyle(欄);
        return {
            方向: 様式.flexDirection,
            折返し: 様式.flexWrap,
            数: 要素一覧.length,
            同じ左端: 要素一覧.every((枠) => Math.abs(枠.left - 要素一覧[0]!.left) <= 1),
            同じ幅: 要素一覧.every((枠) => Math.abs(枠.width - 要素一覧[0]!.width) <= 1),
            上から順: 要素一覧.every((枠, i) => i === 0 || 枠.top >= 要素一覧[i - 1]!.bottom + 7),
            囲い幅: 欄.closest(".一覧")?.getBoundingClientRect().width ?? 0,
            収まる: Boolean(欄.closest(".一覧") && 欄.getBoundingClientRect().right
                <= 欄.closest(".一覧")!.getBoundingClientRect().right),
            最初の名: 欄.querySelector("code")?.textContent ?? "",
            中央差: (() => {
                const 外 = 欄.closest(".一覧")?.getBoundingClientRect();
                const 内 = 欄.closest(".縦案内節")?.getBoundingClientRect();
                return 外 && 内 ? (外.left + 外.right) / 2 - (内.left + 内.right) / 2 : -1000;
            })(),
        };
    });
    if (単独版の縦並び.方向 !== "column" || 単独版の縦並び.折返し !== "nowrap"
        || 単独版の縦並び.数 !== 7 || 単独版の縦並び.最初の名 !== "tsuzuri.js"
        || Math.abs(単独版の縦並び.中央差) > 160
        || !単独版の縦並び.同じ左端
        || !単独版の縦並び.同じ幅
        || !単独版の縦並び.上から順 || 単独版の縦並び.囲い幅 > 360
        || !単独版の縦並び.収まる) {
        throw new Error("デスクトップで単独ライブラリー名が縦一列ではありません: "
            + JSON.stringify(単独版の縦並び));
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

    // 縦組見本の大字二列・小字・朱印が一切重ならないことを実測する。
    await 頁.evaluate(() => document.fonts.ready);
    for (const 横幅 of [1280, 1024, 820, 390, 320]) {
        await 頁.setViewportSize({ width: 横幅, height: 800 });
        const 見本配置 = await 頁.locator(".主題見本").evaluate((要素) => {
            const 矩形 = (式: string): DOMRect => {
                const 対象 = 要素.querySelector(式);
                if (!対象) throw new Error("見本の文字列が見つかりません: " + 式);
                return 対象.getBoundingClientRect();
            };
            const 第一 = 矩形(".主題見本先");
            const 第二 = 矩形(".主題見本後");
            const 添字 = 矩形(".主題見本添");
            const 朱印 = 矩形(".朱印");
            const 外枠 = 要素.getBoundingClientRect();
            const 重なる = (甲: DOMRect, 乙: DOMRect): boolean =>
                Math.min(甲.right, 乙.right) - Math.max(甲.left, 乙.left) > 1
                && Math.min(甲.bottom, 乙.bottom) - Math.max(甲.top, 乙.top) > 1;
            const 文字 = [第一, 第二, 添字];
            return {
                列間: [第一.left - 第二.right, 第二.left - 添字.right],
                順序: 第一.left > 第二.left && 第二.left > 添字.left,
                重複: 文字.some((甲, i) => 文字.some((乙, j) => i < j && 重なる(甲, 乙))),
                印と重複: 文字.some((甲) => 重なる(甲, 朱印)),
                枠内: 文字.every((枠) => 枠.left >= 外枠.left - 1 && 枠.right <= 外枠.right + 1),
                向き: getComputedStyle(要素.querySelector(".主題見本先")!).writingMode,
                文字: 要素.textContent,
            };
        });
        if (!見本配置.順序 || 見本配置.重複 || 見本配置.印と重複
            || !見本配置.枠内 || 見本配置.向き !== "vertical-rl"
            || 見本配置.列間.some((距離) => 距離 < 5)
            || !見本配置.文字?.includes("書を愉しむ、すべての人へ。")) {
            throw new Error("縦組見本の文字または朱印が重なっています: "
                + JSON.stringify({ 横幅, ...見本配置 }));
        }
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });

    const 合成数 = await 頁.locator(".綴り-文字").count();
    const 縦書数 = await 頁.locator(".綴り-縦書").count();
    const 読み数 = await 頁.locator(".綴り-振仮名").count();
    const 旧暦 = await 頁.locator(".綴り-暦").first().textContent();
    const 向き = await 頁.locator(".綴り-縦書").first().evaluate((要素) => getComputedStyle(要素).writingMode);
    const 表記 = await 頁.locator(".作品見本 .綴り-原字").first().textContent();
    const 描画字 = await 頁.locator(".綴り-既定字").allTextContents();
    await 頁.evaluate(() => document.fonts.ready);
    const 書体 = await 頁.locator(".綴り-既定字").first()
        .evaluate((要素) => getComputedStyle(要素).fontFamily);
    const 読込済み = await 頁.evaluate(() =>
        Array.from(document.fonts).some((候補) =>
            候補.family.includes("IDS Composer Demo") && 候補.status === "loaded"
        )
    );
    const 選択 = await 頁.locator(".作品見本 .綴り-原字").first().evaluate((要素) => {
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


    // 朗読の非固定パネルは本文の上へ重なる。別機能の操作前に収納する。
    await 頁.mouse.move(5, 5);
    await 頁.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await 頁.waitForFunction(() => {
        const 内容 = document.querySelector(".朗読内容");
        return Boolean(内容 && getComputedStyle(内容).visibility === "hidden");
    });
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
    const 目次の縁を検査 = async (): Promise<void> => {
        const 配置 = await 目次側.evaluate((側) => {
            const 引手 = 側.querySelector(".目次引手");
            const 側の様式 = getComputedStyle(側);
            const 引手の様式 = 引手 ? getComputedStyle(引手) : null;
            const 側枠 = 側.getBoundingClientRect();
            const 引手枠 = 引手?.getBoundingClientRect();
            return {
                上ずれ: (引手枠?.top ?? -100) - 側枠.top,
                側左上: 側の様式.borderTopLeftRadius,
                側左下: 側の様式.borderBottomLeftRadius,
                側右上: 側の様式.borderTopRightRadius,
                側右下: 側の様式.borderBottomRightRadius,
                引手左上: 引手の様式?.borderTopLeftRadius ?? "",
                引手左下: 引手の様式?.borderBottomLeftRadius ?? "",
                引手右上: 引手の様式?.borderTopRightRadius ?? "",
                引手右下: 引手の様式?.borderBottomRightRadius ?? "",
            };
        });
        if (Math.abs(配置.上ずれ) > 1
            || 配置.側左上 !== "0px" || 配置.側左下 !== "0px"
            || 配置.側右上 !== "5px" || 配置.側右下 !== "5px"
            || 配置.引手左上 !== "0px" || 配置.引手左下 !== "0px"
            || 配置.引手右上 !== "4px" || 配置.引手右下 !== "4px") {
            throw new Error("目次の外側の角丸と最上部の引手が不正です: " + JSON.stringify(配置));
        }
    };
    await 目次の縁を検査();
    const 初期収納 = await 目次側.evaluate((要素) => ({
        左: 要素.getBoundingClientRect().left,
        親右: 要素.parentElement?.getBoundingClientRect().right ?? 0,
    }));
    if (await 読書面.getAttribute("data-index-pinned") !== "false"
        || Math.abs(初期収納.親右 - 初期収納.左 - 34) > 5) {
        throw new Error("目次が初期状態で収納されていません: " + JSON.stringify(初期収納));
    }
    await 引手.hover();
    await 目次の縁を検査();

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

    // 目次の題名は合成漢字と振仮名を使い、続く「の露」と一体に並べる。
    const 目次題名 = await 頁.locator("#物語目次 .目次リンク-1 .目次リンク文字").first().evaluate((要素) => {
        const 合成 = 要素.querySelector(".綴り-文字");
        const 処理領域 = 要素.querySelector(".綴り-本文");
        const 読み = 要素.querySelector("rt");
        return {
            原文: 合成?.querySelector(".綴り-原字")?.textContent,
            読み: 読み?.textContent,
            続き: 要素.textContent?.endsWith("の露"),
            文字数: 合成?.querySelectorAll(".綴り-単字").length,
            向き: 処理領域 ? getComputedStyle(処理領域).writingMode : "",
            表示: 処理領域 ? getComputedStyle(処理領域).display : "",
        };
    });
    if (目次題名.原文 !== "⿱白萩" || 目次題名.読み !== "しらはぎ"
        || !目次題名.続き || 目次題名.文字数 !== 2
        || 目次題名.向き !== "vertical-rl" || 目次題名.表示 !== "inline") {
        throw new Error("目次の合成漢字と書式が不正です: " + JSON.stringify(目次題名));
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
    const 初期展開数 = await 頁.locator("#物語目次 details.目次開閉[open]").count();
    if (目次数 !== 12 || !目次の検証 || 目次の方向 !== "vertical-rl"
        || 展開の数 !== 2 || 初期展開数 !== 0) {
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
        下線方向: getComputedStyle(要素).textUnderlinePosition,
    }));
    if (!斜体の形式.傾斜.includes("italic") || !斜体の形式.装飾.includes("underline")
        || 斜体の形式.下線方向 !== "left") {
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
        || await 下部リンク.getAttribute("href") !== 支援先 || !下部版?.includes("v" + 公開版)) {
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

    await 目次の縁を検査();
    if (!(await 頁.locator(".上部 .印 .綴り-文字").isVisible())
        || await 頁.locator(".上部 .印 ruby, .上部 .印 rt").count() !== 0) {
        throw new Error("携帯画面の標章が見えないか、不要な振仮名が残っています");
    }
    const 携帯標章 = await 頁.locator(".上部 .印 .印章").evaluate((枠) => {
        const 字 = 枠.querySelector(".綴り-文字")?.getBoundingClientRect();
        const 外 = 枠.getBoundingClientRect();
        return {
            枠幅: 外.width,
            中心差: 字 ? (字.left + 字.right - 外.left - 外.right) / 2 : 999,
            縦中心差: 字 ? (字.top + 字.bottom - 外.top - 外.bottom) / 2 : 999,
            枠内: Boolean(字 && 字.left >= 外.left && 字.right <= 外.right
                && 字.top >= 外.top && 字.bottom <= 外.bottom),
        };
    });
    if (携帯標章.枠幅 < 40 || Math.abs(携帯標章.中心差) > 2.5
        || Math.abs(携帯標章.縦中心差) > 2.5 || !携帯標章.枠内) {
        throw new Error("携帯で合成漢字が金枠の中央に収まっていません: "
            + JSON.stringify(携帯標章));
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
                ".縦案内節 .記法対応", ".縦案内節 .記法題",
                ".縦案内節 .記法表枠",
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
            const 表枠 = document.querySelector(".記法表枠");
            const 表 = 表枠?.querySelector("table");
            const 縦案内 = document.querySelector(".記法題");
            const 縦体 = 縦案内?.querySelector(".綴り-縦書");
            const 縦寸法 = 縦案内?.getBoundingClientRect();
            const 表寸法 = 表枠?.getBoundingClientRect();
            const 外枠 = 表枠?.closest(".記法対応")?.getBoundingClientRect();
            return {
                窓幅: innerWidth,
                超過幅: 根.scrollWidth - 根.clientWidth,
                左端, 右端, 主題幅: 主題?.width ?? 0,
                主題中心差: ((見出し?.left ?? 0) + (見出し?.right ?? 0)) / 2
                    - (左端 + 右端) / 2,
                範囲, 重なり, 手順,
                説明の縦組: Boolean(縦案内 && 縦体 && 縦寸法 && 表寸法
                    && getComputedStyle(縦体).writingMode === "vertical-rl"
                    && getComputedStyle(縦案内).borderBottomStyle === "solid"
                    && 縦寸法.bottom <= 表寸法.top - 4),
                表の収納: Boolean(表枠 && 表 && 表寸法 && 外枠
                    && 表寸法.left >= 外枠.left - 1
                    && 表寸法.right <= 外枠.right + 1
                    && 表枠.scrollWidth >= 表枠.clientWidth
                    && 表.scrollWidth >= 表枠.clientWidth),
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
            || !配置.一覧内 || !配置.表の収納 || !配置.説明の縦組) {
            throw new Error("携帯表示が欄外へ溢れたり内容を重ねています: "
                + JSON.stringify({ 横幅, ...配置, はみ出し }));
        }
    }
    const 携帯版の並び = await 頁.locator(".一覧格子").evaluate((欄) => {
        const 様式 = getComputedStyle(欄);
        return { 方向: 様式.flexDirection, 折返し: 様式.flexWrap };
    });
    if (携帯版の並び.方向 !== "row" || 携帯版の並び.折返し !== "wrap") {
        throw new Error("携帯の単独ライブラリー名が従来の折返しになっていません: "
            + JSON.stringify(携帯版の並び));
    }
    await 頁.setViewportSize({ width: 1280, height: 800 });
    // Azure の実契約を使わず、SDK と同じ口で日本語女性音声の合成要求を検証する。
    await 頁.evaluate(() => {
        const 偽の音声 = {
            SpeechConfig: {
                fromSubscription: (鍵: string, 地域: string) => {
                    document.documentElement.dataset.azureRegion = 地域;
                    document.documentElement.dataset.azureKeyAccepted = String(鍵 === "綴り朗読検査用");
                    return {
                        speechSynthesisVoiceName: "",
                        setProperty: (_番号: number, _値: number): void => {},
                    };
                },
            },
            SpeechSynthesizer: class {
                speakSsmlAsync(
                    本文: string,
                    完了: (結果: { reason: number; audioData: ArrayBuffer }) => void,
                    _失敗: (理由: unknown) => void,
                ): void {
                    document.documentElement.dataset.azureSsml = 本文;
                    完了({ reason: 1, audioData: new ArrayBuffer(24) });
                }
                close(): void {}
            },
            PropertyId: { SpeechSynthesisOutputFormat: 1 },
            SpeechSynthesisOutputFormat: { Audio16Khz32KBitRateMonoMp3: 1 },
            ResultReason: { SynthesizingAudioCompleted: 1 },
        };
        Object.assign(window, { SpeechSDK: 偽の音声 });
    });
    await 頁.locator("#朗読引手").hover();
    await 頁.locator("#朗読設定").evaluate((詳細) => {
        if (詳細 instanceof HTMLDetailsElement) 詳細.open = true;
    });
    await 頁.locator("#朗読鍵").fill("綴り朗読検査用");
    await 頁.locator("#朗読地域").selectOption("japaneast");
    await 頁.locator("#朗読再生").click();
    await 頁.waitForFunction(() => Boolean(document.documentElement.dataset.azureSsml));
    const 要求した声 = await 頁.evaluate(() => ({
        言語: document.documentElement.dataset.azureSsml ?? "",
        地域: document.documentElement.dataset.azureRegion,
        鍵: document.documentElement.dataset.azureKeyAccepted,
        保存: localStorage.getItem("綴り-朗読鍵"),
    }));
    if (!要求した声.言語.includes('xml:lang="ja-JP"')
        || !要求した声.言語.includes('voice name="ja-JP-NanamiNeural"')
        || !要求した声.言語.includes("しらはぎのつゆ")
        || 要求した声.地域 !== "japaneast" || 要求した声.鍵 !== "true"
        || 要求した声.保存 !== "綴り朗読検査用") {
        throw new Error("Azure の日本語女性音声への要求が不正です: "
            + JSON.stringify({ ...要求した声, 保存: 要求した声.保存 === "綴り朗読検査用" }));
    }
    // 目の SVG ボタンは、表示と非表示を切り替える。
    const 目 = 頁.locator("#朗読鍵表示");
    if (await 頁.locator("#朗読鍵").getAttribute("type") !== "password") {
        throw new Error("キーの初期表示が隠されていません");
    }
    await 目.click();
    if (await 頁.locator("#朗読鍵").getAttribute("type") !== "text"
        || await 目.getAttribute("aria-pressed") !== "true") {
        throw new Error("キーの表示切替が動作していません");
    }
    await 目.click();
    if (await 頁.locator("#朗読鍵").getAttribute("type") !== "password"
        || await 目.getAttribute("aria-pressed") !== "false") {
        throw new Error("キーを再び隠せません");
    }

    // タブを再読込してもキーは残るが、可視状態は引き継がない。
    await 頁.reload();
    if (await 頁.locator("#朗読鍵").inputValue() !== "綴り朗読検査用"
        || await 頁.locator("#朗読鍵").getAttribute("type") !== "password") {
        throw new Error("localStorage のキーが再読込後に復元されません");
    }
    await 頁.locator("#朗読引手").hover();
    await 頁.locator("#朗読設定").evaluate((詳細) => {
        if (詳細 instanceof HTMLDetailsElement) 詳細.open = true;
    });
    await 頁.locator("#朗読鍵").fill("");
    if (await 頁.evaluate(() => localStorage.getItem("綴り-朗読鍵")) !== null) {
        throw new Error("キーを空にした際の保存削除が動作していません");
    }
    // 旧版 sessionStorage の値は一度移して削除する。
    await 頁.evaluate(() => sessionStorage.setItem("綴り-朗読鍵", "旧版の鍵"));
    await 頁.reload();
    const 移行 = await 頁.evaluate(() => ({
        鍵: (document.querySelector("#朗読鍵") as HTMLInputElement).value,
        保存: localStorage.getItem("綴り-朗読鍵"),
        旧保存: sessionStorage.getItem("綴り-朗読鍵"),
    }));
    if (移行.鍵 !== "旧版の鍵" || 移行.保存 !== "旧版の鍵" || 移行.旧保存 !== null) {
        throw new Error("旧版のキーを移行できません: " + JSON.stringify(移行));
    }
    await 頁.locator("#朗読引手").hover();
    await 頁.locator("#朗読設定").evaluate((詳細) => {
        if (詳細 instanceof HTMLDetailsElement) 詳細.open = true;
    });
    await 頁.locator("#朗読鍵").fill("");
    // 偽音声は再生できないため、再生完了後の停止ボタンは無効でもよい。

    // 自動地域検出、漢字より振仮名を優先する読み、秘密鍵を隠した失敗表示。
    const 自動試験 = await ブラウザー.newPage();
    await 自動試験.addInitScript(() => {
        const 元の取得 = window.fetch;
        window.fetch = Object.assign((入力: RequestInfo | URL, 初期?: RequestInit): Promise<Response> => {
            const 先 = typeof 入力 === "string" ? 入力
                : 入力 instanceof URL ? 入力.href : 入力.url;
            if (先.includes(".tts.speech.microsoft.com/cognitiveservices/voices/list")) {
                document.documentElement.dataset.地域照合 = 先;
                return Promise.resolve(new Response("[]", { status: 200 }));
            }
            return 元の取得(入力, 初期);
        }, { preconnect: 元の取得.preconnect });
        const 偽音声 = {
            SpeechConfig: {
                fromSubscription: (_鍵: string, 地域: string) => {
                    document.documentElement.dataset.自動地域 = 地域;
                    return { speechSynthesisVoiceName: "",
                        setProperty: (_種類: number, _番号: number): void => {} };
                },
            },
            SpeechSynthesizer: class {
                speakSsmlAsync(
                    原文: string,
                    _完了: (結果: { reason: number; audioData: ArrayBuffer }) => void,
                    失敗: (理由: unknown) => void,
                ): void {
                    document.documentElement.dataset.振仮名の検査 = 原文;
                    失敗(new Error("接続拒否: 綴り朗読検査用"));
                }
                close(): void {}
            },
            PropertyId: { SpeechSynthesisOutputFormat: 1 },
            SpeechSynthesisOutputFormat: { Audio16Khz32KBitRateMonoMp3: 1 },
            ResultReason: { SynthesizingAudioCompleted: 1 },
        };
        Object.assign(window, { SpeechSDK: 偽音声 });
    });
    const 自動例外: string[] = [];
    自動試験.on("pageerror", (例外内容) => 自動例外.push(例外内容.message));
    await 自動試験.goto("http://127.0.0.1:" + String(配信.port));
    await 自動試験.waitForSelector("#朗読再生", { state: "attached" });
    await 自動試験.locator("#朗読引手").hover();
    await 自動試験.evaluate(() => {
        const 読む = document.createElement("p");
        読む.innerHTML = '<ruby>初音<rt>はつね</rt></ruby>は<ruby>⿰燈心<rt>とうしん</rt></ruby>を持つ。江戸の夜。';
        window.readAloudState.paragraphs[0] = 読む;
    });
    await 自動試験.locator("#朗読設定").evaluate((詳細) => {
        if (詳細 instanceof HTMLDetailsElement) 詳細.open = true;
    });
    await 自動試験.locator("#朗読鍵").fill("綴り朗読検査用");
    if (await 自動試験.locator("#朗読地域").inputValue() !== "") {
        throw new Error("地域の既定値が自動検出になっていません");
    }
    await 自動試験.locator("#朗読再生").click();
    await 自動試験.waitForFunction(() =>
        Boolean(document.documentElement.dataset.振仮名の検査), null, { timeout: 5000 });
    await 自動試験.waitForFunction(() =>
        document.querySelector("#朗読状態")?.textContent?.includes("接続拒否") ?? false);
    const 自動結果 = await 自動試験.evaluate(() => ({
        地域: document.documentElement.dataset.自動地域,
        確認先: document.documentElement.dataset.地域照合 ?? "",
        発声: document.documentElement.dataset.振仮名の検査 ?? "",
        エラー: document.querySelector("#朗読状態")?.textContent ?? "",
    }));
    if (自動結果.地域 !== "uksouth" || !自動結果.確認先.includes("uksouth.tts.speech.microsoft.com")
        || !自動結果.発声.includes("はつね")
        || !自動結果.発声.includes("とうしん")
        || !自動結果.発声.includes("江戸")
        || 自動結果.発声.includes("初音") || 自動結果.発声.includes("⿰燈心")
        || !自動結果.エラー.includes("[秘匿]")
        || 自動結果.エラー.includes("綴り朗読検査用")
        || 自動例外.length > 0) {
        throw new Error("自動地域・振仮名・安全な失敗表示が不正です: "
            + JSON.stringify({ ...自動結果, 例外: 自動例外 }));
    }
    await 自動試験.close();

    // 別ページで固定・自動収納・保存復元・携帯の領域確保を確認する。
    const 収納試験 = await ブラウザー.newPage({ viewport: { width: 1280, height: 800 } });
    await 収納試験.goto("http://127.0.0.1:" + String(配信.port));
    await 収納試験.waitForSelector("#朗読固定", { state: "attached" });
    const 収納見た目 = await 収納試験.evaluate(() => {
        const 引手 = document.querySelector("#朗読引手");
        const 目次引手 = document.querySelector("#目次引手");
        const 固定 = document.querySelector("#朗読固定");
        if (!引手 || !目次引手 || !固定) return null;
        const 朗読色 = getComputedStyle(引手);
        const 目次色 = getComputedStyle(目次引手);
        return {
            固定は内容内: Boolean(document.querySelector("#朗読内容")?.contains(固定)),
            固定は非表示: getComputedStyle(固定).visibility === "hidden",
            文字色: 朗読色.color,
            目次文字色: 目次色.color,
            背景: 朗読色.backgroundColor,
            目次背景: 目次色.backgroundColor,
            看板の影: getComputedStyle(document.querySelector(".朗読看板")!).boxShadow,
        };
    });
    if (!収納見た目?.固定は内容内 || !収納見た目.固定は非表示
        || 収納見た目.文字色 !== 収納見た目.目次文字色
        || 収納見た目.背景 !== 収納見た目.目次背景
        || 収納見た目.看板の影 === "none") {
        throw new Error("収納時の固定ボタンか朱色の引手が目次に一致しません: " + JSON.stringify(収納見た目));
    }
    const 収納の接合を調べる = async (): Promise<Readonly<{
        間隔: number; 左ずれ: number; 右ずれ: number;
        上枠: number; 巻物上枠: number; 見出し間隔: number; 同じ容器: boolean;
    }>> => 収納試験.locator(".物語節 > .容器").evaluate((箱) => {
        const 巻 = 箱.querySelector(".物語読書面")?.getBoundingClientRect();
        const 朗読 = 箱.querySelector(".朗読収納")?.getBoundingClientRect();
        const 見出し = 箱.querySelector(".物語冒頭")?.getBoundingClientRect();
        const 枠 = 箱.querySelector(".朗読看板");
        return {
            間隔: (巻?.top ?? 0) - (朗読?.bottom ?? 0),
            左ずれ: Math.abs((朗読?.left ?? 0) - (巻?.left ?? 0)),
            右ずれ: Math.abs((朗読?.right ?? 0) - (巻?.right ?? 0)),
            上枠: 枠 ? Number.parseFloat(getComputedStyle(枠).borderTopWidth) : -1,
            巻物上枠: 箱.querySelector(".物語読書面")
                ? Number.parseFloat(getComputedStyle(箱.querySelector(".物語読書面")!).borderTopWidth) : -1,
            同じ容器: (() => {
                const 読書枠 = 箱.querySelector(".物語読書枠");
                return Boolean(読書枠 && 読書枠.children[0] === 箱.querySelector(".朗読収納")
                    && 読書枠.children[1] === 箱.querySelector(".物語読書面")
                    && getComputedStyle(読書枠).flexDirection === "column");
            })(),
            見出し間隔: (巻?.top ?? 0) - (見出し?.bottom ?? 0),
        };
    });
    const 接合を確認する = (位置: string, 寸法: Awaited<ReturnType<typeof 収納の接合を調べる>>): void => {
        if (Math.abs(寸法.間隔) > 1.5 || 寸法.左ずれ > 1.5
            || 寸法.右ずれ > 1.5 || 寸法.上枠 < 1
            || 寸法.巻物上枠 !== 0 || !寸法.同じ容器) {
            throw new Error("朗読の引手が巻物の上辺に接続していません: "
                + JSON.stringify({ 位置, ...寸法 }));
        }
    };
    接合を確認する("大画面・収納", await 収納の接合を調べる());
    await 収納試験.locator("#朗読引手").hover();
    await 収納試験.waitForFunction(() =>
        (document.querySelector(".朗読内容")?.getBoundingClientRect().height ?? 0) > 95);
    await 収納試験.waitForTimeout(350);
    const 展開時 = await 収納試験.locator(".朗読収納").evaluate((要素) => {
        const 内容 = 要素.querySelector(".朗読内容");
        const 巻 = document.querySelector(".物語読書面")?.getBoundingClientRect();
        const 収納 = 要素.getBoundingClientRect();
        const 内容枠 = 内容?.getBoundingClientRect();
        return {
            高さ: 収納.height,
            内容高: 内容枠?.height ?? 0,
            内容位置: 内容 ? getComputedStyle(内容).position : "",
            影: 内容 ? getComputedStyle(内容).boxShadow : "none",
            巻上: 巻?.top ?? 0,
            収納下: 収納.bottom,
            内容下: 内容枠?.bottom ?? 0,
            状態: 要素.querySelector("#朗読引手")?.getAttribute("aria-expanded"),
        };
    });
    if (展開時.状態 !== "true" || 展開時.内容高 < 95
        || 展開時.高さ < 36 || 展開時.高さ > 46
        || 展開時.内容位置 !== "absolute" || 展開時.影 === "none"
        || Math.abs(展開時.巻上 - 展開時.収納下) > 1.5
        || 展開時.内容下 < 展開時.巻上 + 50) {
        throw new Error("非固定の朗読が巻物を動かさず、影付きで重なりません: " + JSON.stringify(展開時));
    }
    接合を確認する("大画面・非固定の展開", await 収納の接合を調べる());
    if (!(await 収納試験.locator("#朗読固定").isVisible())) {
        throw new Error("展開時に内部の固定ボタンが表示されません");
    }
    await 収納試験.locator("#朗読固定").click();
    await 収納試験.waitForTimeout(350);
    await 収納試験.mouse.move(10, 10);
    await 収納試験.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const 保存確認 = await 収納試験.locator(".朗読収納").evaluate((要素) => {
        const 巻 = document.querySelector(".物語読書面")?.getBoundingClientRect();
        const 収納 = 要素.getBoundingClientRect();
        const 内容 = 要素.querySelector(".朗読内容");
        return {
            固定: 要素.getAttribute("data-readaloud-pinned"),
            保存: localStorage.getItem("綴り-物語朗読固定"),
            高さ: 収納.height,
            内容位置: 内容 ? getComputedStyle(内容).position : "",
            巻上: 巻?.top ?? 0,
            収納下: 収納.bottom,
            押下: 要素.querySelector("#朗読固定")?.getAttribute("aria-pressed"),
        };
    });
    if (保存確認.固定 !== "true" || 保存確認.保存 !== "true"
        || 保存確認.押下 !== "true" || 保存確認.高さ < 95
        || 保存確認.内容位置 !== "relative"
        || 保存確認.巻上 < 展開時.巻上 + 50
        || Math.abs(保存確認.巻上 - 保存確認.収納下) > 1.5) {
        throw new Error("固定時に朗読が巻物を押し下げず保存されません: " + JSON.stringify(保存確認));
    }
    接合を確認する("大画面・固定", await 収納の接合を調べる());
    await 収納試験.reload();
    await 収納試験.waitForSelector(".朗読収納[data-readaloud-pinned='true']");
    const 復元 = await 収納試験.locator(".朗読収納").evaluate((要素) =>
        要素.getBoundingClientRect().height);
    if (復元 < 95) throw new Error("朗読の固定が再読込後に復元されません");
    await 収納試験.locator(".朗読収納").evaluate((要素) => {
        const 内容 = 要素.querySelector(".朗読内容");
        if (!内容 || getComputedStyle(内容).position !== "relative") {
            throw new Error("再読込後の朗読が通常フローへ戻りません");
        }
    });

    for (const 幅 of [390, 320, 430]) {
        await 収納試験.setViewportSize({ width: 幅, height: 840 });
        const 携帯寸法 = await 収納試験.locator(".物語節 > .容器").evaluate((箱) => {
            const 巻 = 箱.querySelector(".物語読書面")?.getBoundingClientRect();
            const 収納 = 箱.querySelector(".朗読収納")?.getBoundingClientRect();
            const 左欄 = document.querySelector(".下部")?.getBoundingClientRect();
            const 右欄 = document.querySelector(".上部")?.getBoundingClientRect();
            return {
                巻上: 巻?.top ?? 0, 収納下: 収納?.bottom ?? 0,
                収納左: 収納?.left ?? 0, 収納右: 収納?.right ?? 0,
                左端: 左欄?.right ?? 0, 右端: 右欄?.left ?? innerWidth,
                横超過: document.documentElement.scrollWidth - innerWidth,
                高さ: 収納?.height ?? 0,
            };
        });
        接合を確認する("携帯・固定・" + String(幅), await 収納の接合を調べる());
        if (携帯寸法.巻上 < 携帯寸法.収納下 - 1
            || 携帯寸法.収納左 < 携帯寸法.左端 - 2
            || 携帯寸法.収納右 > 携帯寸法.右端 + 2
            || 携帯寸法.横超過 > 3 || 携帯寸法.高さ < 95) {
            throw new Error("携帯の朗読が巻物や左右の欄に重なっています: "
                + JSON.stringify({ 幅, ...携帯寸法 }));
        }
    }
    await 収納試験.setViewportSize({ width: 1280, height: 800 });
    await 収納試験.locator("#朗読固定").click();
    await 収納試験.mouse.move(10, 10);
    await 収納試験.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await 収納試験.waitForTimeout(400);
    const 収納後 = await 収納試験.locator(".朗読収納").evaluate((要素) => ({
        高さ: 要素.getBoundingClientRect().height,
        固定: localStorage.getItem("綴り-物語朗読固定"),
    }));
    if (収納後.高さ < 36 || 収納後.高さ > 46 || 収納後.固定 !== "false"
        || await 収納試験.locator("#朗読固定").isVisible()) {
        throw new Error("固定解除時に朗読の引手へ戻らないか、固定ボタンが見えています: "
            + JSON.stringify(収納後));
    }
    接合を確認する("大画面・解除", await 収納の接合を調べる());
    await 収納試験.close();

    console.log("実ブラウザーでの表示検査に合格しました。");
} finally {
    await ブラウザー.close();
    配信.stop();
}

