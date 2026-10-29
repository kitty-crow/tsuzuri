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

const 漢字要素 = "jp-kanji, kanji, t-漢字";
const 描画対象 = [
    "jp-kanji",
    "tsuzuri kanji", "tsuzuri t-漢字",
    "t-綴 kanji", "t-綴 t-漢字",
].join(", ");

/** 新しい要素では合成方向を明示し、旧来の要素だけ上下を既定とする。 */
function 配置を読む(元: Element): 配置 | null {
    if (元.hasAttribute("horizontal") || 元.hasAttribute("横")) return "左右";
    if (元.hasAttribute("vertical") || 元.hasAttribute("縦")) return "上下";
    if (!元.matches("jp-kanji")) return null;
    return 属性(元, "alignment") === "horizontal" ? "左右" : "上下";
}

function 節点から解析(節点: Node): 文字 | null {
    if (節点 instanceof Element) {
        return 節点.matches(漢字要素) ? 要素から解析(節点) : null;
    }
    const 記号 = Array.from(節点.textContent?.trim() ?? "");
    return 記号.length === 1 ? { 字: 記号[0]! } : null;
}

function 要素から解析(元: Element): 文字 | null {
    const 子 = Array.from(元.childNodes).filter((節点) =>
        節点.nodeType === Node.ELEMENT_NODE
        || (節点.nodeType === Node.TEXT_NODE && Boolean(節点.textContent?.trim())));
    const 配置 = 配置を読む(元);
    if (子.some((節点) => 節点.nodeType === Node.ELEMENT_NODE)) {
        if (子.length !== 2 || !配置) return null;
        const 第一 = 節点から解析(子[0]!);
        const 第二 = 節点から解析(子[1]!);
        return 第一 && 第二 ? { 配置, 部品: [第一, 第二] } : null;
    }
    const 記号 = Array.from(元.textContent?.trim() ?? "");
    const 指示 = 構文解析(記号, 0);
    if (指示 && 指示[1] === 記号.length) return 指示[0];
    if (記号.length !== 2 || !配置) return null;
    return { 配置, 部品: [{ 字: 記号[0]! }, { 字: 記号[1]! }] };
}

function 表意記号(構造: 文字): string {
    if ("字" in 構造) return 構造.字;
    const 指示 = 構造.配置 === "左右" ? "⿰" : "⿱";
    return 指示 + 表意記号(構造.部品[0]) + 表意記号(構造.部品[1]);
}


/** 原型を保持しながら、各部品を筆画の形ごと圧縮する。 */
function 部品を描く(
    構造: 文字, 左: number, 上: number, 幅: number, 高さ: number, 親: HTMLElement,
): void {
    if ("字" in 構造) {
        const 字 = document.createElement("span");
        字.className = "綴り-単字";
        字.textContent = 構造.字;
        字.style.left = String(左 * 100) + "%";
        字.style.top = String(上 * 100) + "%";
        字.style.transform = "scale(" + String(幅) + ", " + String(高さ) + ")";
        親.append(字);
        return;
    }
    const 左右 = 構造.配置 === "左右";
    const 半幅 = 左右 ? 幅 / 2 : 幅;
    const 半高 = 左右 ? 高さ : 高さ / 2;
    部品を描く(構造.部品[0], 左, 上, 半幅, 半高, 親);
    部品を描く(
        構造.部品[1], 左 + (左右 ? 半幅 : 0),
        上 + (左右 ? 0 : 半高), 半幅, 半高, 親,
    );
}

function 描画(構造: 文字): HTMLElement {
    const 箱 = document.createElement("span");
    箱.className = "綴り-合成 綴り-伸縮字";
    部品を描く(構造, 0, 0, 1, 1, 箱);
    return 箱;
}

/** 元の実演資料で描かれた字形。未知の組合せは伸縮描画に切り替える。 */
const 既定字形: Readonly<Record<string, string>> = {
    "⿱日本": "\uE100",
    "⿰日本": "\uE101",
    "⿱⿰日本語": "\uE102",
    "⿱⿰日本⿰語学": "\uE103",
};


function 合成表示を作る(構造: 文字): DocumentFragment {
    const 断片 = document.createDocumentFragment();
    const 原文 = document.createElement("span");
    原文.className = "綴り-原字";
    原文.textContent = 表意記号(構造);
    const 視覚 = document.createElement("span");
    視覚.className = "綴り-視字";
    視覚.setAttribute("aria-hidden", "true");
    const 専用字 = 既定字形[原文.textContent];
    視覚.classList.add(専用字 ? "綴り-既定字" : "綴り-伸縮字");
    if (専用字) 視覚.textContent = 専用字;
    if (!専用字) 視覚.append(描画(構造));
    断片.append(原文, 視覚);
    return 断片;
}

/** 表意文字記述と要素の入れ子を同じ構造として描画する。 */
export function 書道を描く(根: ParentNode): void {
    置換(根, 描画対象, (元) => {
        const 解析 = 要素から解析(元);
        const 合成 = Boolean(解析 && ("配置" in 解析 || 元.matches("jp-kanji")));
        const 読み = 元.matches("t-漢字") ? 属性(元, "振り") : 属性(元, "reading");
        const 表示 = document.createElement("span");
        表示.className = 合成 ? "綴り-文字" : "";
        表示.lang = "ja";
        if (合成 && 解析) 表示.append(合成表示を作る(解析));
        if (!合成) {
            while (元.firstChild) 表示.append(元.firstChild);
        }
        if (!読み) {
            if (合成 || 元.matches("jp-kanji")) return 表示;
            const 内容 = document.createDocumentFragment();
            while (表示.firstChild) 内容.append(表示.firstChild);
            return 内容;
        }
        const ルビ = document.createElement("ruby");
        ルビ.lang = "ja";
        ルビ.className = 合成 ? "綴り-振仮名 綴り-合成ルビ" : "綴り-振仮名";
        const 注記 = document.createElement("rt");
        注記.textContent = 読み;
        if (合成) ルビ.append(表示, 注記);
        if (!合成) {
            while (表示.firstChild) ルビ.append(表示.firstChild);
            ルビ.append(注記);
        }
        return ルビ;
    });
}
