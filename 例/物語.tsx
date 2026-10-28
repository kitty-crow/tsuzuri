import { readFile } from "node:fs/promises";
import { createElement, Fragment, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";

type 章 = Readonly<{ 日付: string; 段落: readonly string[]; 字句: readonly Token[] }>;
type 合成語 = Readonly<{ 構文: string; 読み: string }>;

const 人名: Readonly<Record<string, string>> = {
    "清七": "せいしち",
    "初音": "はつね",
    "久兵衛": "きゅうべえ",
};

const 合成候補: Readonly<Record<string, 合成語>> = {
    "白萩": { 構文: "⿱白萩", 読み: "しらはぎ" },
    "燈心": { 構文: "⿰燈心", 読み: "とうしん" },
    "行燈": { 構文: "⿱行燈", 読み: "あんどん" },
    "初音": { 構文: "⿰初音", 読み: "はつね" },
};

const 特徴的な語 = /(清七|初音|久兵衛|白萩|燈心|行燈)/g;

/** 与えられた本文の順序と語句は変えず、表示要素だけを付す。 */
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

export function 原稿を章に分ける(原稿: string): readonly 章[] {
    const 部分 = 原稿.trim().split(/\n\n(?=### \d{4}-\d{2}-\d{2})/);
    if (部分.length !== 8) throw new Error("物語の章数が一致しません");
    return 部分.slice(1).map((本文) => {
        const [見出し, ...段落] = 本文.trim().split(/\n\n/);
        const 日付 = /^### (\d{4}-\d{2}-\d{2})$/.exec(見出し ?? "")?.[1];
        if (!日付 || 段落.length === 0) throw new Error("章の日付と本文が必要です");
        return { 日付, 段落, 字句: marked.lexer(段落.join("\n\n")) };
    });
}


/** Markdown を型付きの字句から安全な要素へ変換する。 */
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

function リンクを描く(行先: string, 内容: ReactNode, 番号: number): ReactNode {
    const 安全 = /^(https?:\/\/|#)/i.test(行先);
    return 安全 ? <a key={番号} href={行先}>{内容}</a> : <Fragment key={番号}>{内容}</Fragment>;
}

function 段落を描く(項目: Token, 使用済み: Set<string>, 番号: number): ReactNode {
    if (項目.type === "paragraph" || 項目.type === "text") {
        return <p key={番号} className="物語段落">{文中を描く(項目.tokens ?? [], 使用済み)}</p>;
    }
    if (項目.type === "blockquote") {
        return <blockquote key={番号} className="物語書状">{区画を描く(項目.tokens ?? [], 使用済み)}</blockquote>;
    }
    if (項目.type === "heading") {
        return <h4 key={番号} className="物語小見出し">{文中を描く(項目.tokens ?? [], 使用済み)}</h4>;
    }
    if (項目.type === "hr") return <hr key={番号} className="物語区切り" />;
    if (項目.type === "code") return <pre key={番号} className="物語原文"><code>{項目.text}</code></pre>;
    if (項目.type === "list") {
        const 内容 = 項目.items.map((要素: Tokens.ListItem, 順: number) => <li key={順}>{区画を描く(要素.tokens ?? [], 使用済み)}</li>);
        return 項目.ordered ? <ol key={番号} className="物語列挙">{内容}</ol> : <ul key={番号} className="物語列挙">{内容}</ul>;
    }
    return null;
}

function 区画を描く(字句: readonly Token[], 使用済み: Set<string>): ReactNode[] {
    return 字句.map((項目, 番号) => 段落を描く(項目, 使用済み, 番号));
}

/** React は静的な紹介ページの組み立て専用。配布物には含めない。 */
export async function 物語の見本(): Promise<ReactNode> {
    const 原稿 = await readFile("例/白萩の露.md", "utf8");
    const 章 = 原稿を章に分ける(原稿);
    const 使用済み = new Set<string>();

    return (
        <section id="物語" className="節 物語節">
            <div className="容器">
                <div className="節題">
                    <p className="眉">綴りによる縦書きの実例</p>
                    <h2>白萩の露</h2>
                    <p>しらはぎのつゆ</p>
                    <p>文化年間の江戸を舞台とした物語。人名の振仮名、合成漢字、古式の暦を織り込みました。</p>
                </div>
                <div className="物語説明" aria-label="表記の説明">
                    <span>人名の読みに振仮名</span>
                    <span>合成漢字は四種類</span>
                    <span>西暦の日付を旧暦へ換算</span>
                    <span>右から左へ読み進めます</span>
                </div>
                {章.map((一章, 番号) => (
                    <article className="物語章" key={一章.日付}>
                        <header className="物語章頭">
                            <span className="章番号">巻 {String(番号 + 1).padStart(2, "0")}</span>
                            {createElement("jp-koyomi", {
                                date: 一章.日付,
                                calendar: "kyureki",
                                eto: 番号 < 4 ? true : undefined,
                                year: 番号 >= 4 ? "same" : undefined,
                                "day-style": 番号 === 4 ? "abbreviated" : undefined,
                            }, 一章.日付)}
                        </header>
                        <div className="物語巻">
                            {createElement("tsuzuri", null,
                                区画を描く(一章.字句, 使用済み)
                            )}
                        </div>
                    </article>
                ))}
                <p className="物語結語">露と消えにし人の名を　花のみぞ知る</p>
            </div>
        </section>
    );
}
