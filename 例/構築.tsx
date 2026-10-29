import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createElement, type ReactNode } from "react";
import { render2Mkup } from "../vendor/website/src/reactHelpers.tsx";
import { 物語の見本 } from "./物語.tsx";

function 合成(構文: string, 読み?: string): ReactNode {
    return createElement("kanji", { "振り": 読み }, 構文);
}
function ルビ(表記: string, 読み: string): ReactNode {
    return createElement("furigana", { "読み": 読み }, 表記);
}
function 縦書(内容: ReactNode): ReactNode {
    return createElement("tsuzuri", null, 内容);
}
function 横書(内容: ReactNode): ReactNode {
    return createElement("tsuzuri", { "横": "" }, 内容);
}
function 例示(名称: string, 内容: ReactNode, 説明: string, 記法: string): ReactNode {
    return (
        <article className="作品">
            <div className="作品頭">
                <div><span className="小見出し">合成文字</span><h3>{名称}</h3></div>
                <span className="識別">縦・横</span>
            </div>
            <div className="作品見本">{横書(内容)}</div>
            <p className="作品説明">{説明}</p>
            <div className="文字列"><code>{記法}</code></div>
        </article>
    );
}

const 記法対応 = [
    ["処理領域", "t-綴", "tsuzuri"],
    ["縦書き領域", "t-縦", "tategaki"],
    ["横書き領域", "t-横", "yokogaki"],
    ["振仮名", "t-振り", "furigana"],
    ["漢字・合成漢字", "t-漢字", "kanji"],
    ["縦方向", "縦", "vertical"],
    ["横方向", "横", "horizontal"],
    ["漢字の振仮名", '振り="..."', 'reading="..."'],
    ["振仮名の読み", '読み="..."', 'reading="..."'],
] as const;

const 物語 = await 物語の見本();
const 版 = (await Bun.file("package.json").json() as { readonly version: string }).version;

const 画面 = (
    <html lang="ja">
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="description" content="綴り。日本語の縦書き、振仮名、合成漢字、組版、漢数字、暦を一つにする描画ライブラリー。" />
            <meta name="theme-color" content="#f6f4ed" />
            <title>綴り | 日本語組版の小さな道具箱</title>
            <link rel="icon" type="image/svg+xml" href="./綴.svg?mark=kanji-only" />
            <link rel="stylesheet" href="./様式.css" />
            <link rel="stylesheet" href="./物語.css" />
            <link rel="stylesheet" href="./朗読.css" />
            <link rel="stylesheet" href="./支援.css" />
            <script src="./dist/tsuzuri.js" defer={true}></script>
            <script src="./配色.js" defer={true}></script>
            <script src="./目次.js" defer={true}></script>
            <script src="./朗読.js" defer={true}></script>
        </head>
        <body>
            <header className="上部">
                <div className="容器 上部中">
                    <a className="印" href="#先頭" aria-label="綴り（つづり）"><span className="印章">{縦書(合成("⿰綴り"))}</span></a>
                    <nav aria-label="ページ内の案内">
                        <a href="#組版">組版</a><a href="#合成">合成漢字</a><a href="#書式">使い方</a><a href="#物語">物語</a>
                        <a href="https://github.com/kitty-crow/tsuzuri">原稿</a>
                        <button type="button" id="配色切替" className="配色切替" aria-label="配色を切り替える" aria-pressed="false" title="配色を切り替える">☾</button>
                    </nav>
                </div>
            </header>
            <main id="先頭">
                <section className="主題 容器">
                    <div className="主題左">
                        <div className="主題見出し">
                            {縦書(<>
                                <p className="眉">日本語の文字表現を、もっと自由に。</p>
                                <h1>文字を<span>綴る。</span><br/>想いを、かたちに。</h1>
                            </>)}
                        </div>
                        <div className="主題縦案内">
                            {縦書(<>
                                <p className="導入">縦書き、振仮名、組版、合成漢字、漢数字、そして暦。一つの読み込みで、日本語の豊かな表現をそのまま書けます。</p>
                                <div className="導入行"><a className="主要" href="#書式">書き方を見る</a><a className="副" href="#合成">実例を見る</a></div>
                                <div className="手引"><span>依存ライブラリー不要</span><span>文字として複写可能</span><span>自動初期化</span></div>
                            </>)}
                        </div>
                    </div>
                    <div className="主題見本" aria-label="縦書きの例">
                        <span className="朱印">和</span>
                        {縦書(<>
                            <span className="主題見本文">
                                <strong className="主題見本先">言の葉を</strong>
                                <strong className="主題見本後">編む。</strong>
                            </span>
                            <small className="主題見本添">書を愉しむ、すべての人へ。</small>
                        </>)}
                    </div>
                </section>
                <section id="組版" className="節 容器 縦案内節">
                    <div className="節題">{縦書(<><p className="眉">言葉と文字</p><h2>日本語を、美しく。</h2><p>縦書きが基本。必要なところだけ横書きに切り替えられます。</p></>)}</div>
                    <div className="機能格子">
                        <article className="機能">
                            <span className="番号">壱</span><h3>縦書き</h3>
                            <div className="短冊">{縦書(<>春はあけぼの。<br/>やうやう白くなりゆく山ぎは。</>)}</div>
                            <p>右から左へ流れる、伝統的な読み心地。</p>
                        </article>
                        <article className="機能">
                            <span className="番号">弐</span><h3>振仮名</h3>
                            <div className="大文字">{横書(<>{ルビ("言葉", "ことば")}を{ルビ("綴る", "つづる")}。</>)}</div>
                            <p>簡潔な要素と読みの指定から、意味のあるルビへ。</p>
                        </article>
                        <article className="機能">
                            <span className="番号">参</span><h3>漢数字と暦</h3>
                            <div className="日付">
                                {横書(createElement("koyomi", { "日付": "2026-10-28", "暦": "旧暦" }, "変換できない日付"))}
                            </div>
                            <p>表記を揃え、時代の趣を添える。旧暦は照合済みの日付に限ります。</p>
                        </article>
                    </div>
                </section>
                <section id="合成" className="節 容器 縦案内節">
                    <div className="節題">{縦書(<><p className="眉">意匠の自由</p><h2>存在しない漢字を、つくる。</h2>
                        <p>縦と横の指定を入れ子にして文字を組み合わせます。振仮名を添えて独自の読みも指定できます。</p></>)}
                    </div>
                    <div className="作品格子">
                        {例示("上下",
                            createElement("kanji", { "縦": "", "振り": "にほん" }, "日本"),
                            "日本を縦に重ねた合成文字。",
                            '<t-漢字 縦 振り="にほん">日本</t-漢字>')}
                        {例示("左右",
                            createElement("kanji", { "横": "", "振り": "にほん" }, "日本"),
                            "同じ二文字を左右に組み合わせる。",
                            '<t-漢字 横 振り="にほん">日本</t-漢字>')}
                        {例示("三文字",
                            createElement("kanji", { "縦": "", "振り": "にほんご" },
                                createElement("kanji", { "横": "" }, "日本"), "語"),
                            "文字の組み合わせは入れ子にできます。",
                            '<t-漢字 縦><t-漢字 横>日本</t-漢字>語</t-漢字>')}
                        {例示("四文字",
                            createElement("kanji", { "縦": "", "振り": "にほんごがく" },
                                createElement("kanji", { "横": "" }, "日本"),
                                createElement("kanji", { "横": "" }, "語学")),
                            "より複雑な合成構造も入れ子で記述できます。",
                            '<t-漢字 縦><t-漢字 横>日本</t-漢字><t-漢字 横>語学</t-漢字></t-漢字>')}
                    </div>
                    <p className="補足">書体に収録された専用字形と、文字の縦横を伸縮する描画を利用します。複写した文字列には、元の記述が残ります。</p>
                </section>
                <section id="書式" className="節 容器 縦案内節">
                    <div className="節題">{縦書(<><p className="眉">使いはじめる</p><h2>書くのは、文字だけ。</h2><p>一つの配布ファイルを読み込み、本文に要素を置くだけ。追加の処理は不要です。</p></>)}</div>
                    <div className="手順">
                        <article>
                            <div className="小見出し 手順題">{縦書("一 · 読み込む")}</div>
                            <pre><code>{'<script src="dist/tsuzuri.js"></script>'}</code></pre>
                        </article>
                        <article>
                            <div className="小見出し 手順題">{縦書("二 · 書いてみる")}</div>
                            <pre><code>{'<t-綴>\n  <t-振り 読み="ことば">言葉</t-振り>\n  <t-漢字 横 振り="つづり">綴り</t-漢字>\n</t-綴>'}</code></pre>
                        </article>
                    </div>
                    <div className="一覧">
                        <div className="一覧題">{縦書(<><h3>個別に読み込む場合</h3>
                        <p>必要な機能だけを選べます。配布物はそれぞれ単独で使用できます。</p></>)}</div>
                        <div className="一覧格子">
                            {["tsuzuri", "furigana", "tategaki", "shoudou", "kumihan", "kansuji", "koyomi"].map((名) =>
                                <code key={名}>{名}.js</code>
                            )}
                        </div>
                    </div>
                    <div className="記法対応">
                        <h3>ローマ字の記法にも対応</h3>
                        <p>日本語の要素名と属性に加え、ローマ字でも同じ機能を利用できます。次の名前は互いに対応しています。</p>
                        <div className="記法表枠">
                            <table>
                                <thead>
                                    <tr><th scope="col">用途</th><th scope="col">日本語</th><th scope="col">ローマ字</th></tr>
                                </thead>
                                <tbody>
                                    {記法対応.map(([用途, 日本語, ローマ字]) =>
                                        <tr key={用途}>
                                            <th scope="row">{用途}</th>
                                            <td><code>{日本語}</code></td>
                                            <td><code>{ローマ字}</code></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                {物語}
            </main>
            <footer className="下部" aria-label="サイトの案内">
                <div className="容器 下部中">
                    <span className="下部版">綴り <span>日本語の文字を美しく</span> <small>v{版}</small></span>
                    <nav className="下部リンク" aria-label="関連するリンク">
                        <a href="https://kittycrow.dev/">公式サイト</a>
                        <span aria-hidden="true">・</span>
                        <a href="https://github.com/kitty-crow/tsuzuri">ソースコード</a>
                        <span aria-hidden="true">・</span>
                        <a className="pages-kofi-link" href="https://ko-fi.com/kittycrow" target="_blank" rel="noopener noreferrer">
                            <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="" loading="lazy" />
                            珈琲で応援
                        </a>
                    </nav>
                </div>
            </footer>
            <a className="支援側帯" href="https://ko-fi.com/kittycrow"
                target="_blank" rel="noopener noreferrer" aria-label="珈琲で応援する">
                <img className="支援杯" src="https://storage.ko-fi.com/cdn/cup-border.png" alt="" />
                {createElement("tategaki", null, "珈琲で応援")}
            </a>
        </body>
    </html>
);

await mkdir("site", { recursive: true });
await mkdir("site/dist", { recursive: true });
for (const 名前 of ["furigana", "tategaki", "shoudou", "kumihan", "kansuji", "koyomi", "tsuzuri"]) {
    await copyFile("dist/" + 名前 + ".js", "site/dist/" + 名前 + ".js");
    await copyFile("dist/" + 名前 + ".css", "site/dist/" + 名前 + ".css");
}
/** 生成器では英字名を使い、完成した HTML だけを日本語の要素名へ置き換える。 */
const 日本語の要素名: Readonly<Record<string, string>> = {
    tsuzuri: "t-綴",
    kanji: "t-漢字",
    furigana: "t-振り",
    koyomi: "t-暦",
    tategaki: "t-縦",
};
const 日本語HTML = render2Mkup(画面).replace(
    /<(\/?)(tsuzuri|kanji|furigana|koyomi|tategaki)(?=[\s>])/g,
    (全文, 閉じ: string, 名称: string) => "<" + 閉じ + (日本語の要素名[名称] ?? 全文),
);
await writeFile("site/index.html", "<!doctype html>\n" + 日本語HTML + "\n", "utf8");
await copyFile("例/様式.css", "site/様式.css");
await copyFile("例/綴.svg", "site/綴.svg");
await copyFile("例/物語.css", "site/物語.css");
await copyFile("例/朗読.css", "site/朗読.css");
await copyFile("node_modules/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js", "site/音声SDK.js");
await copyFile("例/支援.css", "site/支援.css");
await writeFile("site/.nojekyll", "", "utf8");
const 配色の構築 = await Bun.build({
    entrypoints: ["例/配色.ts"],
    outdir: "site",
    naming: { entry: "配色.js" },
    target: "browser",
    format: "iife",
    minify: true,
});
if (!配色の構築.success) throw new Error("配色の構築に失敗しました");
const 目次の構築 = await Bun.build({
    entrypoints: ["例/目次.ts"],
    outdir: "site",
    naming: { entry: "目次.js" },
    target: "browser",
    format: "iife",
    minify: true,
});
if (!目次の構築.success) throw new Error("目次の構築に失敗しました");
const 朗読の構築 = await Bun.build({
    entrypoints: ["例/朗読.ts"],
    outdir: "site",
    naming: { entry: "朗読.js" },
    target: "browser",
    format: "iife",
    minify: true,
});
if (!朗読の構築.success) throw new Error("朗読の構築に失敗しました");

console.log("紹介ページを構築しました。");

