import { 属性, 包む, 置換 } from "./中核.ts";

/** 対象領域だけ縦書きを既定とし、周囲の文書には影響させない。 */
export function 縦書を描く(根: ParentNode): void {
    置換(根, "tsuzuri", (元) => {
        const 横書 = 元.hasAttribute("horizontal") || 属性(元, "direction") === "horizontal";
        return 包む(元, 横書 ? "綴り-本文 綴り-横書" : "綴り-本文 綴り-縦書");
    });
    置換(根, "jp-tategaki", (元) => 包む(元, "綴り-本文 綴り-縦書"));
    置換(根, "jp-yokogaki", (元) => 包む(元, "綴り-本文 綴り-横書"));
    置換(根, "jp-tcy", (元) => 包む(元, "綴り-縦中横"));
}

