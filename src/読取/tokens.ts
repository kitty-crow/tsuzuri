import type { Token } from "./types.ts";

const words = new Intl.Segmenter("ja", { granularity: "word" });
const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });
// Unicodeの文字特性から文字種を分類する。
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const latin = /\p{Script=Latin}/u;
const numeric = /\p{Number}/u;
const punctuation = /[\p{Punctuation}\p{Symbol}]/u;
const space = /\p{White_Space}/u;

function kind(text: string): Token["kind"] {
    if (japanese.test(text)) return "japanese";
    if (latin.test(text)) return "latin";
    if (numeric.test(text)) return "number";
    if (space.test(text)) return "space";
    if (punctuation.test(text)) return "punctuation";
    return "other";
}

/** 単語と書記素を分割し、原文中のUTF-16位置を記録する。 */
export function tokenise(text: string): Token[] {
    const result: Token[] = [];
    for (const word of words.segment(text)) {
        let run = "";
        let start = word.index;
        let category: Token["kind"] = "other";
        for (const part of graphemes.segment(word.segment)) {
            const current = kind(part.segment);
            if (run && current !== category) result.push({ start, end: word.index + part.index, text: run, kind: category, word: Boolean(word.isWordLike) });
            if (current !== category) { run = ""; start = word.index + part.index; }
            category = current;
            run += part.segment;
        }
        if (run) result.push({ start, end: word.index + word.segment.length, text: run, kind: category, word: Boolean(word.isWordLike) });
    }
    return result;
}

export function japaneseShare(tokens: readonly Token[]): number {
    const meaningful = tokens.filter((token) => token.kind !== "space" && token.kind !== "punctuation");
    const total = meaningful.reduce((sum, token) => sum + Array.from(token.text).length, 0);
    const count = meaningful.filter((token) => token.kind === "japanese").reduce((sum, token) => sum + Array.from(token.text).length, 0);
    return total ? count / total : 0;
}
