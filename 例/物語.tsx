import { readFile } from "node:fs/promises";
import { createElement, Fragment, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";

type 合成語 = Readonly<{ 構文: string; 読み: string }>;
type 日付設定 = Readonly<{ 干支?: boolean; 同年?: boolean; 廿?: boolean; 吉日?: boolean }>;

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

const 特徴的な語 = /(清七|初音|久兵衛|白萩|燈心|行燈)/g;
const 西暦 = /^\d{4}-\d{2}-\d{2}$/;

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
    const 見出し = 字句.filter((項目): 項目 is Tokens.Heading => 項目.type === "heading");
    const 日付 = 見出し.filter((項目) => 項目.depth === 3 && 西暦.test(項目.text.trim()));
    if (見出し.filter((項目) => 項目.depth === 1).length !== 1) throw new Error("題名は一つ必要です");
    if (日付.length !== 10) throw new Error("物語と後日譚の日付は十箇所必要です");
    return 字句;
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

function 見出しを描く(項目: Tokens.Heading, 使用済み: Set<string>, 番号: number): ReactNode {
    if (項目.depth === 1) {
        return <h2 key={番号} className="物語大題">{文中を描く(項目.tokens ?? [], 使用済み)}</h2>;
    }
    if (項目.depth === 2) {
        return <h3 key={番号} id="後日譚" className="物語後日題">{文中を描く(項目.tokens ?? [], 使用済み)}</h3>;
    }
    if (項目.depth === 3 && 西暦.test(項目.text.trim())) {
        return <h4 key={番号} className="物語年月">{日付を描く(項目.text.trim())}</h4>;
    }
    return <h4 key={番号} className="物語小見出し">{文中を描く(項目.tokens ?? [], 使用済み)}</h4>;
}

function 段落を描く(項目: Token, 使用済み: Set<string>, 番号: number): ReactNode {
    if (項目.type === "heading") return 見出しを描く(項目, 使用済み, 番号);
    if (項目.type === "paragraph" || 項目.type === "text") {
        return <p key={番号} className="物語段落">{文中を描く(項目.tokens ?? [], 使用済み)}</p>;
    }
    if (項目.type === "blockquote") {
        return <blockquote key={番号} className="物語書状">{区画を描く(項目.tokens ?? [], 使用済み)}</blockquote>;
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

/** 一つの巻物として組む。書式は Markdown、和暦は綴りに委ねる。 */
export async function 物語の見本(): Promise<ReactNode> {
    const 原稿 = await readFile("例/白萩の露.md", "utf8");
    const 字句 = 原稿を読む(原稿);
    const 使用済み = new Set<string>();

    return (
        <section id="物語" className="節 物語節">
            <div className="容器">
                <div className="節題">
                    <p className="眉">日本語の縦書きの実例</p>
                    <h2>物語を、ひと巻に綴る。</h2>
                    <p>一つの原稿に題名・章・後日譚を収めました。すべての見出しと文章は Markdown から組み上げます。</p>
                </div>
                <div className="物語説明">
                    <span>人名の振仮名</span>
                    <span>合成漢字</span>
                    <span>旧暦の章題</span>
                    <span>右から左へ読む一巻の物語</span>
                </div>
                <article className="物語巻" aria-label="白萩の露と後日譚">
                    {createElement("tsuzuri", null, 区画を描く(字句, 使用済み))}
                </article>
                <p className="物語注記">※ 祝言の吉日は日付が特定されていないため、文化十二年弥生の一日を資料内の代表日として用ゐてをります。</p>
            </div>
        </section>
    );
}
