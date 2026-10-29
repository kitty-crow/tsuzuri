import { 属性, 包む, 置換 } from "./中核.ts";

/** 指定した領域だけを組版し、周囲の文書には影響させない。 */
export function 縦書を描く(根: ParentNode): void {
    置換(根, "tsuzuri, t-綴", (元) => {
        const 横書 = 元.hasAttribute("horizontal") || 元.hasAttribute("横")
            || 属性(元, "direction") === "horizontal";
        return 包む(元, 横書 ? "綴り-本文 綴り-横書" : "綴り-本文 綴り-縦書");
    });
    置換(根, "jp-tategaki, tategaki, t-縦", (元) => 包む(元, "綴り-本文 綴り-縦書"));
    置換(根, "jp-yokogaki, yokogaki, t-横", (元) => 包む(元, "綴り-本文 綴り-横書"));
    置換(根, "jp-tcy, tsuzuri tcy, tsuzuri t-縦中横, t-綴 tcy, t-綴 t-縦中横",
        (元) => 包む(元, "綴り-縦中横"));
}
