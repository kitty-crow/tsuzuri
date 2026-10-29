import { 属性, 置換 } from "./中核.ts";

const 数字 = Array.from("〇一二三四五六七八九");
const 大字 = Array.from("零壹貳參肆伍陸漆捌玖");
const 位 = ["", "十", "百", "千"] as const;
const 大位 = ["", "拾", "佰", "阡"] as const;
const まとまり = ["", "万", "億", "兆"] as const;

function 四桁(数値: number, 正式: boolean): string {
    const 語 = 正式 ? 大字 : 数字;
    const 単位 = 正式 ? 大位 : 位;
    let 出力 = "";
    for (let 桁 = 3; 桁 >= 0; 桁 -= 1) {
        const 数 = Math.floor(数値 / 10 ** 桁) % 10;
        if (数 === 0) continue;
        const 一を省く = 数 === 1 && 桁 > 0;
        出力 += (一を省く ? "" : 語[数]!) + 単位[桁]!;
    }
    return 出力;
}

/** 十進整数を漢数字へ変換する。扱う範囲は兆未満の非負整数。 */
export function 漢数字へ(数値: number, 形式: "位取り" | "各桁" | "大字" = "位取り"): string {
    if (!Number.isSafeInteger(数値) || 数値 < 0 || 数値 >= 10 ** 16) return "";
    const 語 = 形式 === "大字" ? 大字 : 数字;
    if (形式 === "各桁") return Array.from(String(数値), (字) => 語[Number(字)]!).join("");
    if (数値 === 0) return 語[0]!;
    let 出力 = "";
    for (let 群 = 3; 群 >= 0; 群 -= 1) {
        const 数 = Math.floor(数値 / 10 ** (群 * 4)) % 10000;
        if (数 === 0) continue;
        出力 += 四桁(数, 形式 === "大字") + まとまり[群]!;
    }
    return 出力;
}

export function 漢数字を描く(根: ParentNode): void {
    置換(根, "jp-kansuji, tsuzuri kansuji, tsuzuri t-漢数字, t-綴 kansuji, t-綴 t-漢数字", (元) => {
        const 原文 = 属性(元, "値") || 属性(元, "value") || 元.textContent?.trim() || "";
        const 形式の指定 = 属性(元, "形式") || 属性(元, "style");
        const 形式: "位取り" | "各桁" | "大字" =
            形式の指定 === "digits" || 形式の指定 === "各桁" ? "各桁"
                : 形式の指定 === "daiji" || 形式の指定 === "大字" ? "大字" : "位取り";
        const 結果 = 漢数字へ(Number(原文), 形式);
        const 出力 = document.createElement("span");
        出力.className = "綴り-漢数字";
        出力.lang = "ja";
        出力.textContent = /^(0|[1-9]\d*)$/.test(原文) && 結果 ? 結果 : 原文;
        return 出力;
    });
}

