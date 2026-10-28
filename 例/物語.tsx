import { readFile } from "node:fs/promises";
import { createElement, Fragment, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";

type 合成語 = Readonly<{ 構文: string; 読み: string }>;
type 日付設定 = Readonly<{ 干支?: boolean; 同年?: boolean; 廿?: boolean; 吉日?: boolean }>;

const 人名: Readonly<Record<string, string>> = {
    "清七": "せいしち",
    "初音": "はつね",
    "久兵衛": "きゅうべえ",
    "海藤": "かいとう",
    "主様": "ぬしさま",
};

const 合成候補: Readonly<Record<string, 合成語>> = {
    "白萩": { 構文: "⿱白萩", 読み: "しらはぎ" },
    "燈心": { 構文: "⿰燈心", 読み: "とうしん" },
    "行燈": { 構文: "⿱行燈", 読み: "あんどん" },
    "初音": { 構文: "⿰初音", 読み: "はつね" },
};

const 日付の装ひ: Readonly<Record<string, 日付設定>> = {
    "1809-12-22": { 干支: true },
    "1811-05-24": { 干支: true },
    "1813-10-06": { 干支: true },
    "1814-05-09": { 干支: true },
    "1814-10-10": { 同年: true, 廿: true },
    "1814-10-21": { 同年: true },
    "1814-11-26": { 同年: true },
    "1814-11-27": { 干支: true },
    "1814-12-09": { 同年: true, 廿: true },
    "1815-04-15": { 干支: true, 吉日: true },
};

const 特徴的な語 = /(清七|初音|久兵衛|海藤|主様|白萩|燈心|行燈)/g;
const 西暦 = /^\d{4}-\d{2}-\d{2}$/;

export function 見出しか(項目: Token): 項目 is Tokens.Heading {
    return 項目.type === "heading" && "depth" in 項目 && typeof 項目.depth === "number"
        && "text" in 項目 && typeof 項目.text === "string";
}

/** 人名の読みをすべて示し、合成文字はそれぞれ初出に限る。 */
export function 文章を装ふ(文章: string, 使用済み: Set<string>): ReactNode[] {
    return 文章.split(特徴的な語).map((語, 番号) => {
        const 合成 = 合成候補[語];
        const 読み = 人名[語];
        if (合成 && !使用済み.has(語)) {
            使用済み.add(語);
            return createElement("jp-kanji", { key: 番号, reading: 合成.読み }, 合成.構文);
        }
        if (読み) return createElement("jp-furigana", { key: 番号, reading: 読み }, 語);
        return 語;
    });
}

/** 一つの Markdown 原稿をそのまま字句へ変換する。章ごとには分割しない。 */
export function 原稿を読む(原稿: string): readonly Token[] {
    const 字句 = marked.lexer(原稿);
    const 見出し = 字句.filter(見出しか);
    const 日付 = 見出し.filter((項目) => 項目.depth === 3 && 西暦.test(項目.text.trim()));
    if (見出し.filter((項目) => 項目.depth === 1).length !== 1) throw new Error("題名は一つ必要です");
    if (日付.length !== 10) throw new Error("物語と後日譚の日付は十箇所必要です");
    return 字句;
}

type 目次節 = {
    識別: string;
    階層: number;
    表記: string;
    子: 目次節[];
};

export type 目次構成 = Readonly<{
    節: readonly 目次節[];
    識別表: ReadonlyMap<Tokens.Heading, string>;
}>;

/** 見出しの名称と階層を Markdown の字句から取り出す。 */
export function 目次を組む(字句: readonly Token[]): 目次構成 {
    const 節: 目次節[] = [];
    const 親の列: 目次節[] = [];
    const 識別表 = new Map<Tokens.Heading, string>();
    for (const 項目 of 字句) {
        if (!見出しか(項目)) continue;
        const 番号 = 識別表.size + 1;
        const 見出し: 目次節 = {
            識別: "物語-見出し-" + String(番号).padStart(3, "0"),
            階層: 項目.depth,
            表記: 項目.text.trim(),
            子: [],
        };
        識別表.set(項目, 見出し.識別);
        if (見出し.階層 <= 2) 親の列.length = 0;
        while (親の列.length > 0 && 親の列[親の列.length - 1]!.階層 >= 見出し.階層) 親の列.pop();
        const 親 = 親の列[親の列.length - 1];
        if (親) 親.子.push(見出し);
        if (!親) 節.push(見出し);
        親の列.push(見出し);
    }
    return { 節, 識別表 };
}

function 目次リンク(節: 目次節): ReactNode {
    const 日付 = 節.階層 === 3 && 西暦.test(節.表記);
    return (
        <a className={"目次リンク 目次リンク-" + String(節.階層)}
            href={"#" + 節.識別} data-target={節.識別}>
            <span className="目次リンク文字">{日付 ? 日付を描く(節.表記) : 節.表記}</span>
        </a>
    );
}

/** 折り畳みは標準の details と CSS に任せる。 */
function 目次の節(節: 目次節, 初期展開: boolean): ReactNode {
    return (
        <li key={節.識別} className={"目次節 目次段-" + String(節.階層)}>
            {目次リンク(節)}
            {節.子.length > 0 ? (
                <details className="目次開閉" open={初期展開}>
                    <summary aria-label={節.表記 + "の見出し一覧を開閉"} title="見出しを開閉">
                        <span className="目次開閉印" aria-hidden="true">⌄</span>
                        <span className="目次開閉案内">章を開く</span>
                    </summary>
                    <div className="目次展開">
                        <ul className="目次子">
                            {節.子.map((子) => 目次の節(子, false))}
                        </ul>
                    </div>
                </details>
            ) : null}
        </li>
    );
}

function 日付を描く(日付: string): ReactNode {
    const 設定 = 日付の装ひ[日付];
    return createElement("jp-koyomi", {
        date: 日付,
        calendar: "kyureki",
        eto: 設定?.干支 ? true : undefined,
        year: 設定?.同年 ? "same" : undefined,
        "day-style": 設定?.吉日 ? "auspicious" : 設定?.廿 ? "abbreviated" : undefined,
    }, 日付);
}

function リンクを描く(行先: string, 内容: ReactNode, 番号: number): ReactNode {
    const 安全 = /^(https?:\/\/|#)/i.test(行先);
    return 安全 ? <a key={番号} href={行先}>{内容}</a> : <Fragment key={番号}>{内容}</Fragment>;
}

function 文中を描く(字句: readonly Token[], 使用済み: Set<string>): ReactNode[] {
    return 字句.map((項目, 番号) => {
        if (項目.type === "text" || 項目.type === "escape") {
            return <Fragment key={番号}>{文章を装ふ(項目.text, 使用済み)}</Fragment>;
        }
        if (項目.type === "strong") return <strong key={番号}>{文中を描く(項目.tokens ?? [], 使用済み)}</strong>;
        if (項目.type === "em") return <em key={番号}>{文中を描く(項目.tokens ?? [], 使用済み)}</em>;
        if (項目.type === "del") return <del key={番号}>{文中を描く(項目.tokens ?? [], 使用済み)}</del>;
        if (項目.type === "codespan") return <code key={番号}>{項目.text}</code>;
        if (項目.type === "br") return <br key={番号} />;
        if (項目.type === "link") return リンクを描く(項目.href, 文中を描く(項目.tokens ?? [], 使用済み), 番号);
        if ("text" in 項目 && typeof 項目.text === "string") {
            return <Fragment key={番号}>{文章を装ふ(項目.text, 使用済み)}</Fragment>;
        }
        return null;
    });
}

function 見出しを描く(項目: Tokens.Heading, 使用済み: Set<string>, 番号: number, 識別: string): ReactNode {
    if (項目.depth === 1) {
        return <h2 key={番号} id={識別} className="物語大題">{文中を描く(項目.tokens ?? [], 使用済み)}</h2>;
    }
    if (項目.depth === 2) {
        return <h3 key={番号} id={識別} className="物語後日題">{文中を描く(項目.tokens ?? [], 使用済み)}</h3>;
    }
    if (項目.depth === 3 && 西暦.test(項目.text.trim())) {
        return <h4 key={番号} id={識別} className="物語年月">{日付を描く(項目.text.trim())}</h4>;
    }
    return <h4 key={番号} id={識別} className="物語小見出し">{文中を描く(項目.tokens ?? [], 使用済み)}</h4>;
}

function 段落を描く(項目: Token, 使用済み: Set<string>, 番号: number, 識別表: ReadonlyMap<Tokens.Heading, string>): ReactNode {
    if (見出しか(項目)) return 見出しを描く(項目, 使用済み, 番号, 識別表.get(項目) ?? "");
    if (項目.type === "paragraph" || 項目.type === "text") {
        return <p key={番号} className="物語段落">{文中を描く(項目.tokens ?? [], 使用済み)}</p>;
    }
    if (項目.type === "blockquote") {
        return <blockquote key={番号} className="物語書状">{区画を描く(項目.tokens ?? [], 使用済み, 識別表)}</blockquote>;
    }
    if (項目.type === "hr") return <hr key={番号} className="物語区切り" />;
    if (項目.type === "code") return <pre key={番号} className="物語原文"><code>{項目.text}</code></pre>;
    if (項目.type === "list") {
        const 内容 = 項目.items.map((要素: Tokens.ListItem, 順: number) => <li key={順}>{区画を描く(要素.tokens ?? [], 使用済み, 識別表)}</li>);
        return 項目.ordered ? <ol key={番号} className="物語列挙">{内容}</ol> : <ul key={番号} className="物語列挙">{内容}</ul>;
    }
    return null;
}

function 区画を描く(字句: readonly Token[], 使用済み: Set<string>, 識別表: ReadonlyMap<Tokens.Heading, string>): ReactNode[] {
    return 字句.map((項目, 番号) => 段落を描く(項目, 使用済み, 番号, 識別表));
}

/** 一つの巻物として組む。書式は Markdown、和暦は綴りに委ねる。 */
export async function 物語の見本(): Promise<ReactNode> {
    const 原稿 = await readFile("例/白萩の露.md", "utf8");
    const 字句 = 原稿を読む(原稿);
    const 目次 = 目次を組む(字句);
    const 使用済み = new Set<string>();

    return (
        <section id="物語" className="節 物語節">
            <div className="容器">
                <div className="物語冒頭">
                    {createElement("tsuzuri", null, <h2>日本語の物語と縦書きの実例</h2>)}
                </div>
                <div className="朗読操作" aria-label="白萩の露の音声朗読">
                    <div className="朗読主操作">
                        <span className="朗読題">声に出して読む</span>
                        <span className="朗読声">Azure · 七海（女性・日本語）</span>
                        <button id="朗読前" type="button" aria-label="前の段落">前へ</button>
                        <button id="朗読再生" type="button" aria-pressed="false">再生</button>
                        <button id="朗読次" type="button" aria-label="次の段落">次へ</button>
                        <button id="朗読停止" type="button">停止</button>
                    </div>
                    <details id="朗読設定" className="朗読設定">
                        <summary>音声の設定</summary>
                        <div className="朗読設定中">
                            <label htmlFor="朗読鍵">Azure Speech のキー</label>
                            <input id="朗読鍵" type="password" autoComplete="off"
                                placeholder="ご自身の Azure Speech キー" spellCheck={false} />
                            <label htmlFor="朗読地域">Azure の地域</label>
                            <select id="朗読地域" defaultValue="uksouth">
                                <option value="uksouth">英国南部</option>
                                <option value="japaneast">日本東部</option>
                                <option value="japanwest">日本西部</option>
                                <option value="westeurope">欧州西部</option>
                                <option value="northeurope">欧州北部</option>
                                <option value="eastus">米国東部</option>
                                <option value="eastus2">米国東部２</option>
                                <option value="westus2">米国西部２</option>
                                <option value="southeastasia">東南アジア</option>
                                <option value="australiaeast">豪州東部</option>
                            </select>
                            <p>キーはこのタブの中にだけ保存され、公開ページには含まれません。音声合成は Azure Speech に接続します。</p>
                        </div>
                    </details>
                    <output id="朗読状態" role="status" aria-live="polite">朗読を準備しています。</output>
                </div>
                <div className="物語読書面" data-index-pinned="false">
                    <article id="物語本文" className="物語巻" aria-label="白萩の露と後日譚" tabIndex={0}>
                        {createElement("tsuzuri", null, 区画を描く(字句, 使用済み, 目次.識別表))}
                    </article>
                    <aside className="目次側" aria-label="物語の目次">
                        <button id="目次引手" className="目次引手" type="button"
                            aria-controls="物語目次" aria-expanded="false" aria-label="目次を開く">
                            <span aria-hidden="true">目次</span>
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                                strokeLinejoin="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                        <div className="目次看板">
                            <span className="目次小印">目録</span>
                            <span className="目次題字">目次</span>
                            <span className="目次数">{String(目次.識別表.size).padStart(2, "0")} 節</span>
                            <button id="目次固定" className="目次固定" type="button"
                                aria-label="目次を固定する" aria-pressed="false" title="目次を固定する">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                                    strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
                                    <path d="M12 13v8" />
                                </svg>
                            </button>
                        </div>
                        <nav id="物語目次" className="目次領域" aria-label="題名と日付の目次">
                            {createElement("tsuzuri", null,
                                <ul className="目次列">{目次.節.map((節, 番号) => 目次の節(節, 番号 === 0))}</ul>
                            )}
                        </nav>
                        <div className="目次進度" aria-hidden="true"><span /></div>
                        <span className="目次案内">項目を選ぶと巻物が移動します</span>
                    </aside>
                </div>

            </div>
        </section>
    );
}
