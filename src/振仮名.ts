import { 属性, 置換 } from "./中核.ts";

/** 指定した読みを意味のあるルビ要素へ変換する。 */
export function 振仮名を描く(根: ParentNode): void {
    置換(根, [
        "jp-furigana",
        "tsuzuri furigana", "tsuzuri t-振り",
        "t-綴 furigana", "t-綴 t-振り",
    ].join(", "), (元) => {
        const 読み = 元.matches("t-振り") ? 属性(元, "読み") : 属性(元, "reading") || 属性(元, "rt");
        const 表記 = document.createElement("ruby");
        表記.className = "綴り-振仮名";
        表記.lang = "ja";
        while (元.firstChild) 表記.append(元.firstChild);
        const 注記 = document.createElement("rt");
        注記.textContent = 読み;
        表記.append(注記);
        if (表記.querySelector(".綴り-合成")) 表記.classList.add("綴り-合成ルビ");
        return 表記;
    });
}

