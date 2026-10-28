import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createElement, type ReactNode } from "react";
import { render2Mkup } from "../vendor/website/src/reactHelpers.tsx";
import { 物語の見本 } from "./物語.tsx";

function 合成(構文: string, 読み?: string): ReactNode {
    return createElement("jp-kanji", { reading: 読み }, 構文);
}
function ルビ(表記: string, 読み: string): ReactNode {
    return createElement("jp-furigana", { reading: 読み }, 表記);
}
function 縦書(内容: ReactNode): ReactNode {
    return createElement("tsuzuri", null, 内容);
}
function 横書(内容: ReactNode): ReactNode {
    return createElement("tsuzuri", { direction: "horizontal" }, 内容);
}
function 例示(名称: string, 内容: string, 読み: string, 説明: string): ReactNode {
    return (
        <article className="作品">
            <div className="作品頭">
                <div><span className="小見出し">合成文字</span><h3>{名称}</h3></div>
                <span className="識別">⿰ ⿱</span>
            </div>
            <div className="作品見本">{横書(合成(内容, 読み))}</div>
            <p className="作品説明">{説明}</p>
            <div className="文字列"><code>{内容}</code></div>
        </article>
    );
}

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
            <link rel="stylesheet" href="./様式.css" />
            <link rel="stylesheet" href="./物語.css" />
            <link rel="stylesheet" href="./支援.css" />
            <script src="./dist/tsuzuri.js" defer={true}></script>
            <script src="./配色.js" defer={true}></script>
            <script src="./目次.js" defer={true}></script>
            <script src="./支援.js" defer={true}></script>
        </head>
        <body>
            <header className="上部">
                <div className="容器 上部中">
                    <a className="印" href="#先頭">綴り <span>つづり</span></a>
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
                        <p className="眉">日本語の文字表現を、もっと自由に。</p>
                        <h1>文字を<span>綴る。</span><br/>想いを、かたちに。</h1>
                        <p className="導入">縦書き、振仮名、組版、合成漢字、漢数字、そして暦。<br/>一つの読み込みで、日本語の豊かな表現をそのまま書けます。</p>
                        <div className="導入行"><a className="主要" href="#書式">書き方を見る</a><a className="副" href="#合成">実例を見る</a></div>
                        <div className="手引"><span>依存ライブラリー不要</span><span>文字として複写可能</span><span>自動初期化</span></div>
                    </div>
                    <div className="主題見本" aria-label="縦書きの例">
                        <span className="朱印">和</span>
                        {縦書(<><strong>言の葉を<br/>編む。</strong><small>書を愉しむ、すべての人へ。</small></>)}
                    </div>
                </section>
                <section id="組版" className="節 容器">
                    <div className="節題"><p className="眉">言葉と文字</p><h2>日本語を、美しく。</h2><p>縦書きが基本。必要なところだけ横書きに切り替えられます。</p></div>
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
                                {createElement("jp-koyomi", { date:"2026-10-28", calendar:"kyureki" }, "変換できない日付")}
                            </div>
                            <p>表記を揃え、時代の趣を添える。旧暦は照合済みの日付に限ります。</p>
                        </article>
                    </div>
                </section>
                <section id="合成" className="節 容器">
                    <div className="節題"><p className="眉">意匠の自由</p><h2>存在しない漢字を、つくる。</h2>
                        <p>表意文字記述文字列を解釈し、文字を自由に組み合わせます。振仮名を添えて、独自の読みも指定できます。</p>
                    </div>
                    <div className="作品格子">
                        {例示("上下", "⿱日本", "にほん", "日本を縦に重ねた合成文字。")}
                        {例示("左右", "⿰日本", "にほん", "同じ二文字を左右に組み合わせる。")}
                        {例示("三文字", "⿱⿰日本語", "にほんご", "文字の組み合わせは入れ子にできます。")}
                        {例示("四文字", "⿱⿰日本⿰語学", "にほんごがく", "より複雑な合成構造も文字のまま扱えます。")}
                    </div>
                    <p className="補足">書体に収録された専用字形と、文字の縦横を伸縮する描画を利用します。複写した文字列には、元の記述が残ります。</p>
                </section>
                <section id="書式" className="節 容器">
                    <div className="節題"><p className="眉">使いはじめる</p><h2>書くのは、文字だけ。</h2><p>一つの配布ファイルを読み込み、本文に要素を置くだけ。追加の処理は不要です。</p></div>
                    <div className="手順">
                        <article>
                            <div className="小見出し">一 · 読み込む</div>
                            <pre><code>{'<script src="dist/tsuzuri.js"></script>'}</code></pre>
                        </article>
                        <article>
                            <div className="小見出し">二 · 書いてみる</div>
                            <pre><code>{'<tsuzuri>\n  <jp-furigana reading="つづり">綴り</jp-furigana>\n  <jp-kanji reading="にほん">⿱日本</jp-kanji>\n</tsuzuri>'}</code></pre>
                        </article>
                    </div>
                    <div className="一覧">
                        <h3>個別に読み込む場合</h3>
                        <p>必要な機能だけを選べます。配布物はそれぞれ単独で使用できます。</p>
                        <div className="一覧格子">
                            {["furigana", "tategaki", "shoudou", "kumihan", "kansuji", "koyomi"].map((名) =>
                                <code key={名}>{名}.js</code>
                            )}
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
                {createElement("jp-tategaki", null, "珈琲で応援")}
            </a>
            <a className="支援浮輪" href="https://ko-fi.com/kittycrow"
                target="_blank" rel="noopener noreferrer" aria-label="珈琲で応援する">
                <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="" />
            </a>
        </body>
    </html>
);

await mkdir("site", { recursive: true });
await writeFile("site/index.html", "<!doctype html>\n" + render2Mkup(画面) + "\n", "utf8");
await copyFile("例/様式.css", "site/様式.css");
await copyFile("例/物語.css", "site/物語.css");
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
const 支援の構築 = await Bun.build({
    entrypoints: ["例/支援.ts"],
    outdir: "site",
    naming: { entry: "支援.js" },
    target: "browser",
    format: "iife",
    minify: true,
});
if (!支援の構築.success) throw new Error("支援の構築に失敗しました");
console.log("紹介ページを構築しました。");

