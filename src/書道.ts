import { 属性, 置換 } from "./中核.ts";

type 配置 = "左右" | "上下";
type 部材 = Readonly<{ 配置: 配置; 部品: readonly [文字, 文字] }>;
type 文字 = Readonly<{ 字: string }> | 部材;

const 指示子: Readonly<Record<string, 配置>> = { "⿰": "左右", "⿱": "上下" };

function 構文解析(記号: readonly string[], 開始位置: number): readonly [文字, number] | null {
    const 先頭 = 記号[開始位置];
    if (!先頭) return null;
    const 配置 = 指示子[先頭];
    if (!配置) return [{ 字: 先頭 }, 開始位置 + 1];
    const 左 = 構文解析(記号, 開始位置 + 1);
    if (!左) return null;
    const 右 = 構文解析(記号, 左[1]);
    if (!右) return null;
    return [{ 配置, 部品: [左[0], 右[0]] }, 右[1]];
}

function 子要素(元: Element): readonly Element[] {
    return Array.from(元.children).filter((子) => 子.matches("jp-kanji"));
}

function 要素から解析(元: Element): 文字 | null {
    const 子 = 子要素(元);
    if (子.length === 2) {
        const 左 = 要素から解析(子[0]!);
        const 右 = 要素から解析(子[1]!);
        if (!左 || !右) return null;
        const 配置: 配置 = 属性(元, "alignment") === "horizontal" ? "左右" : "上下";
        return { 配置, 部品: [左, 右] };
    }
    const 記号 = Array.from(元.textContent?.trim() ?? "");
    const 指示 = 構文解析(記号, 0);
    if (指示 && 指示[1] === 記号.length) return 指示[0];
    if (記号.length !== 2 || 子.length > 0) return null;
    const 配置: 配置 = 属性(元, "alignment") === "horizontal" ? "左右" : "上下";
    return { 配置, 部品: [{ 字: 記号[0]! }, { 字: 記号[1]! }] };
}

function 描画(構造: 文字): HTMLElement {
    const 葉 = "字" in 構造;
    const 箱 = document.createElement("span");
    箱.className = 葉 ? "綴り-単字" : "綴り-合成 " + (構造.配置 === "左右" ? "綴り-左右" : "綴り-上下");
    if (葉) {
        箱.textContent = 構造.字;
        return 箱;
    }
    for (const 部分 of 構造.部品) {
        const 枠 = document.createElement("span");
        枠.className = "綴り-部分";
        枠.append(描画(部分));
        箱.append(枠);
    }
    return 箱;
}

/** IDS と入れ子になった要素の双方に対応する。 */
export function 書道を描く(根: ParentNode): void {
    置換(根, "jp-kanji", (元) => {
        const 解析 = 要素から解析(元);
        const 表示 = 解析 ? 描画(解析) : document.createElement("span");
        if (!解析) 表示.textContent = 元.textContent;
        表示.classList.add("綴り-文字");
        表示.lang = "ja";
        const 読み = 属性(元, "reading");
        if (!読み) return 表示;
        const ルビ = document.createElement("ruby");
        ルビ.lang = "ja";
        ルビ.className = "綴り-振仮名 綴り-合成ルビ";
        const 注記 = document.createElement("rt");
        注記.textContent = 読み;
        ルビ.append(表示, 注記);
        return ルビ;
    });
}

