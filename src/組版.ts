import { 包む, 置換 } from "./中核.ts";

/** 読み仮名と合成文字は分割しない。 */
type 字単位 = Readonly<{
    節点: Text | Element;
    開始: number;
    終了: number;
}>;

const 分節器 = new Intl.Segmenter("ja", { granularity: "grapheme" });
const 確認済 = new WeakMap<Element, string>();
const 対象選択子 = [
    "tsuzuri p", "tsuzuri li", "tsuzuri blockquote",
    "t-綴 p", "t-綴 li", "t-綴 blockquote",
    "tategaki p", "tategaki li", "tategaki blockquote",
    "t-縦 p", "t-縦 li", "t-縦 blockquote",
    "jp-tategaki p", "jp-tategaki li", "jp-tategaki blockquote",
    ".綴り-縦書 p", ".綴り-縦書 li", ".綴り-縦書 blockquote",
    ".綴り-組版", ".綴り-組版 p",
].join(", ");
const 保護字数 = 3;

/** 行末の三字を切り離さず、一字だけの最終行を作らない。 */
function 字を集める(節点: Node, 結果: 字単位[]): void {
    if (節点 instanceof Text) {
        for (const 部分 of 分節器.segment(節点.data)) {
            結果.push({ 節点, 開始: 部分.index, 終了: 部分.index + 部分.segment.length });
        }
        return;
    }
    if (!(節点 instanceof Element)) return;
    if (節点.matches("ruby, .綴り-文字, .綴り-縦中横")) {
        結果.push({ 節点, 開始: 0, 終了: 0 });
        return;
    }
    if (節点.matches("br, wbr")) {
        結果.length = 0;
        return;
    }
    if (節点.matches("rt, script, style")) return;
    for (const 子 of Array.from(節点.childNodes)) 字を集める(子, 結果);
}

function 範囲を指定(範囲: Range, 字: 字単位, 先頭: boolean): void {
    if (字.節点 instanceof Text && 先頭) 範囲.setStart(字.節点, 字.開始);
    if (字.節点 instanceof Text && !先頭) 範囲.setEnd(字.節点, 字.終了);
    if (字.節点 instanceof Element && 先頭) 範囲.setStartBefore(字.節点);
    if (字.節点 instanceof Element && !先頭) 範囲.setEndAfter(字.節点);
}

/** 以前の保護を外してから新しい末尾を保護する。 */
function 保護を外す(要素: Element): void {
    for (const 箱 of Array.from(要素.querySelectorAll(".綴り-孤立防止"))) {
        箱.replaceWith(...Array.from(箱.childNodes));
    }
    要素.normalize();
}

function 孤立を防ぐ(要素: Element): void {
    const 現在 = 要素.textContent ?? "";
    if (確認済.get(要素) === 現在) return;
    保護を外す(要素);
    const 字群: 字単位[] = [];
    for (const 子 of Array.from(要素.childNodes)) 字を集める(子, 字群);
    const 末尾 = 字群.length - 1;
    if (末尾 < 保護字数 - 1) {
        確認済.set(要素, 要素.textContent ?? "");
        return;
    }
    const 範囲 = document.createRange();
    範囲を指定(範囲, 字群[末尾 - 保護字数 + 1]!, true);
    範囲を指定(範囲, 字群[末尾]!, false);
    const 箱 = document.createElement("span");
    箱.className = "綴り-孤立防止";
    箱.append(範囲.extractContents());
    範囲.insertNode(箱);
    確認済.set(要素, 要素.textContent ?? "");
}

/** 日本語の禁則処理に加え、末尾一～二字の孤立を防ぐ。 */
export function 組版を描く(根: ParentNode): void {
    置換(根, "jp-kumihan, tsuzuri kumihan, tsuzuri t-組版, t-綴 kumihan, t-綴 t-組版", (元) => 包む(元, "綴り-組版"));
    for (const 要素 of Array.from(根.querySelectorAll(対象選択子))) {
        if (要素.querySelector("p, li, blockquote")) continue;
        孤立を防ぐ(要素);
    }
}
