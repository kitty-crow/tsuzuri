import { 属性, 置換 } from "./中核.ts";
import { 漢数字へ } from "./漢数字.ts";

const 和風月名 = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"] as const;
const 十干 = Array.from("甲乙丙丁戊己庚辛壬癸");
const 十二支 = Array.from("子丑寅卯辰巳午未申酉戌亥");

type 旧暦月 = Readonly<{
    始: string;
    年: number;
    月: number;
    日数: 29 | 30;
    元号: string;
    元年: number;
}>;

export type 暦書式 = Readonly<{
    年表示?: "通常" | "同年";
    干支?: boolean;
    廿?: boolean;
}>;

/**
 * 国立天文台の日本暦日データベースと国立国会図書館の大小暦、
 * および和暦対照表で照合した月だけを収録する。
 * 寛政暦の時代を天保暦や現代の中国暦で代用してはならない。
 */
const 照合済: readonly 旧暦月[] = [
    { 始: "1809-12-07", 年: 1809, 月: 11, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "1811-05-22", 年: 1811, 月: 4, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "1813-09-24", 年: 1813, 月: 9, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "1814-04-20", 年: 1814, 月: 3, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "1814-09-14", 年: 1814, 月: 8, 日数: 29, 元号: "文化", 元年: 1804 },
    { 始: "1814-10-13", 年: 1814, 月: 9, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "1814-11-12", 年: 1814, 月: 10, 日数: 30, 元号: "文化", 元年: 1804 },
    { 始: "2026-10-11", 年: 2026, 月: 9, 日数: 29, 元号: "令和", 元年: 2019 },
    { 始: "2026-11-09", 年: 2026, 月: 10, 日数: 30, 元号: "令和", 元年: 2019 },
];

const 元号表 = [
    { 始: "2019-05-01", 名: "令和", 年: 2019 },
    { 始: "1989-01-08", 名: "平成", 年: 1989 },
    { 始: "1926-12-25", 名: "昭和", 年: 1926 },
    { 始: "1912-07-30", 名: "大正", 年: 1912 },
    { 始: "1868-09-08", 名: "明治", 年: 1868 },
] as const;

function 西暦日(入力: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(入力)) return null;
    const 年 = Number(入力.slice(0, 4));
    const 月 = Number(入力.slice(5, 7));
    const 日 = Number(入力.slice(8, 10));
    const 値 = Date.UTC(年, 月 - 1, 日);
    const 日付 = new Date(値);
    if (日付.getUTCFullYear() !== 年 || 日付.getUTCMonth() + 1 !== 月 || 日付.getUTCDate() !== 日) return null;
    return 値;
}

function 干支年(年: number): string {
    const 巡り = ((年 - 1984) % 60 + 60) % 60;
    return (十干[巡り % 10] ?? "") + (十二支[巡り % 12] ?? "");
}

function 年数表記(名: string, 元年: number, 年: number): string {
    const 数 = 年 - 元年 + 1;
    return 名 + (数 === 1 ? "元" : 漢数字へ(数)) + "年";
}

function 新暦の年(入力: string): string {
    const 条件 = 元号表.find((元) => 入力 >= 元.始);
    const 年 = Number(入力.slice(0, 4));
    return 条件 ? 年数表記(条件.名, 条件.年, 年) : "西暦" + 漢数字へ(年, "各桁") + "年";
}

function 旧暦を整える(西暦: number, 書式: 暦書式): string | null {
    const 月 = 照合済.find((候補) => {
        const 始 = 西暦日(候補.始);
        return 始 !== null && 西暦 >= 始 && 西暦 < 始 + 候補.日数 * 86400000;
    });
    if (!月) return null;
    const 始 = 西暦日(月.始);
    if (始 === null) return null;
    const 日 = Math.round((西暦 - 始) / 86400000) + 1;
    const 接頭 = 書式.年表示 === "同年" ? "同年" : 年数表記(月.元号, 月.元年, 月.年);
    const 年干支 = 書式.干支 ? 干支年(月.年) : "";
    const 日付 = 書式.廿 && 日 >= 20 && 日 < 30 ? "廿" + (日 === 20 ? "" : 漢数字へ(日 - 20)) : 漢数字へ(日);
    const 間隔 = 書式.干支 || 書式.年表示 === "同年" ? "　" : "";
    return 接頭 + 年干支 + 間隔 + 和風月名[月.月 - 1] + 日付 + "日";
}

/** 旧暦は検証済みの月だけを扱い、未確認の暦日を推測しない。 */
export function 日付を整える(入力: string, 旧暦: boolean, 書式: 暦書式 = {}): string | null {
    const 西暦 = 西暦日(入力);
    if (西暦 === null) return null;
    if (旧暦) return 旧暦を整える(西暦, 書式);
    const 月 = Number(入力.slice(5, 7));
    const 日 = Number(入力.slice(8, 10));
    return 新暦の年(入力) + 漢数字へ(月) + "月" + 漢数字へ(日) + "日";
}

export function 暦を描く(根: ParentNode): void {
    置換(根, "jp-koyomi", (元) => {
        const 日付 = 属性(元, "date");
        const 旧暦 = 属性(元, "calendar") === "kyureki";
        const 書式: 暦書式 = {
            年表示: 属性(元, "year") === "same" ? "同年" : "通常",
            干支: 元.hasAttribute("eto"),
            廿: 属性(元, "day-style") === "abbreviated",
        };
        const 結果 = 日付を整える(日付, 旧暦, 書式);
        const 表示 = document.createElement("time");
        表示.className = "綴り-暦";
        if (日付) 表示.dateTime = 日付;
        表示.lang = "ja";
        表示.textContent = 結果 ?? (元.textContent?.trim() || 日付);
        if (!結果) 表示.dataset.unconverted = "true";
        if (!結果) 表示.title = "指定された日付を変換できません";
        return 表示;
    });
}
