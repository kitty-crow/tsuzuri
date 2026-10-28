import { 属性, 置換 } from "./中核.ts";
import { 漢数字へ } from "./漢数字.ts";

const 和風月名 = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"] as const;
type 旧暦月 = Readonly<{ 始: string; 月: number; 年: number }>;
/** 照合済みの範囲に限り旧暦として表示する。推定値への自動置換は行わない。 */
const 照合済 = [
    { 始: "2026-10-11", 月: 9, 年: 2026 },
    { 始: "2026-11-09", 月: 10, 年: 2026 },
] as const satisfies readonly 旧暦月[];

function 日本の日付(入力: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(入力)) return null;
    const 日付 = new Date(入力 + "T12:00:00+09:00");
    if (Number.isNaN(日付.getTime())) return null;
    const 確認 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
    const 値 = 確認.formatToParts(日付);
    const 数 = (名称: string): number => Number(値.find((項) => 項.type === 名称)?.value ?? "-1");
    const [年, 月, 日] = 入力.split("-").map(Number);
    return 数("year") === 年 && 数("month") === 月 && 数("day") === 日 ? 日付 : null;
}

const 元号表 = [
    { 始: "2019-05-01", 名: "令和", 年: 2019 },
    { 始: "1989-01-08", 名: "平成", 年: 1989 },
    { 始: "1926-12-25", 名: "昭和", 年: 1926 },
    { 始: "1912-07-30", 名: "大正", 年: 1912 },
    { 始: "1868-09-08", 名: "明治", 年: 1868 },
] as const;

function 元号(入力: string): string {
    const 項目 = 元号表.find((候補) => 入力 >= 候補.始);
    const 年 = Number(入力.slice(0, 4));
    if (!項目) return "西暦" + 漢数字へ(年, "各桁") + "年";
    const 年数 = 年 - 項目.年 + 1;
    return 項目.名 + (年数 === 1 ? "元" : 漢数字へ(年数)) + "年";
}

/** 明示された暦法だけを使用し、日付の補間では旧暦を推測しない。 */
export function 日付を整える(入力: string, 旧暦: boolean): string | null {
    const 日付 = 日本の日付(入力);
    if (!日付) return null;
    const 接頭 = 元号(入力);
    if (!旧暦) {
        const 月 = Number(入力.slice(5, 7));
        const 日 = Number(入力.slice(8, 10));
        return 接頭 + 漢数字へ(月) + "月" + 漢数字へ(日) + "日";
    }
    const 月 = [...照合済].reverse().find((項) => 入力 >= 項.始);
    if (!月 || 入力 >= "2026-12-09") return null;
    const 日 = Math.round((日付.getTime() - new Date(月.始 + "T12:00:00+09:00").getTime()) / 86400000) + 1;
    return 接頭 + 和風月名[月.月 - 1] + 漢数字へ(日) + "日";
}

export function 暦を描く(根: ParentNode): void {
    置換(根, "jp-koyomi", (元) => {
        const 日付 = 属性(元, "date");
        const 旧暦 = 属性(元, "calendar") === "kyureki";
        const 結果 = 日付を整える(日付, 旧暦);
        const 表示 = document.createElement("time");
        表示.className = "綴り-暦";
        if (日付) 表示.dateTime = 日付;
        表示.lang = "ja";
        表示.textContent = 結果 ?? (元.textContent?.trim() || 日付);
        if (!結果) {
            表示.dataset.unconverted = "true";
            表示.title = "指定された日付を変換できません";
        }
        return 表示;
    });
}

