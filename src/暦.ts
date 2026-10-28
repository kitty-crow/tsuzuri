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

function 元号(入力: Date): string {
    const 形式 = new Intl.DateTimeFormat("ja-JP-u-ca-japanese", {
        era: "long", year: "numeric", timeZone: "Asia/Tokyo",
    });
    const 部分 = 形式.formatToParts(入力);
    const 名 = 部分.find((項) => 項.type === "era")?.value ?? "";
    const 年 = 部分.find((項) => 項.type === "year")?.value ?? "";
    return 名 + (年 === "元" ? 年 : 漢数字へ(Number(年))) + "年";
}

/** 明示された暦法だけを使用し、日付の補間では旧暦を推測しない。 */
export function 日付を整える(入力: string, 旧暦: boolean): string | null {
    const 日付 = 日本の日付(入力);
    if (!日付) return null;
    const 接頭 = 元号(日付);
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

