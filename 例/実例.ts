type 記法 = "ids" | "tags";
type 言語 = "日本語" | "ローマ字";

/** 記法と言語を独立して切り替え、実際の描画要素も差し替える。 */
function 構文を選ぶ(作品: HTMLElement): string {
    const 表意 = 作品.dataset["表意"] ?? "";
    const 読み = 作品.dataset["読み"] ?? "";
    const ローマ字 = 作品.dataset["言語"] === "ローマ字";
    if (作品.dataset["記法"] === "tags") {
        return ローマ字 ? 作品.dataset["ローマ字タグ"] ?? "" : 作品.dataset["日本語タグ"] ?? "";
    }
    const 名称 = ローマ字 ? "kanji" : "t-漢字";
    const 読み属性 = ローマ字 ? "reading" : "振り";
    return "<" + 名称 + " " + 読み属性 + '="' + 読み + '">' + 表意 + "</" + 名称 + ">";
}

function 表示を更新(作品: HTMLElement, 再描画: boolean): void {
    const 記法: 記法 = 作品.dataset["記法"] === "tags" ? "tags" : "ids";
    const 言語: 言語 = 作品.dataset["言語"] === "ローマ字" ? "ローマ字" : "日本語";
    const 構文 = 構文を選ぶ(作品);
    const 出力 = 作品.querySelector<HTMLElement>(".文字列 code");
    if (出力) 出力.textContent = 構文;
    const 記法切替 = 作品.querySelector<HTMLButtonElement>('.作品切替[data-切替="記法"]');
    const 言語切替 = 作品.querySelector<HTMLButtonElement>('.作品切替[data-切替="言語"]');
    if (記法切替) {
        記法切替.setAttribute("aria-pressed", String(記法 === "tags"));
        記法切替.setAttribute("aria-label", 記法 === "ids"
            ? "現在は表意文字記述。タグ記法に切り替える"
            : "現在はタグ記法。表意文字記述に切り替える");
    }
    if (言語切替) {
        言語切替.setAttribute("aria-pressed", String(言語 === "ローマ字"));
        言語切替.setAttribute("aria-label", 言語 === "日本語"
            ? "現在は日本語。ローマ字に切り替える" : "現在はローマ字。日本語に切り替える");
    }
    if (!再描画) return;
    const 見本 = 作品.querySelector<HTMLElement>(".作品見本");
    if (!見本) return;
    const 根 = 言語 === "日本語" ? "t-綴" : "tsuzuri";
    const 横属性 = 言語 === "日本語" ? "横" : "horizontal";
    const 仮の容器 = document.createElement("template");
    仮の容器.innerHTML = "<" + 根 + " " + 横属性 + ">" + 構文 + "</" + 根 + ">";
    見本.replaceChildren(仮の容器.content);
}

for (const 作品 of document.querySelectorAll<HTMLElement>("#合成 .作品")) {
    表示を更新(作品, false);
    for (const 切替 of 作品.querySelectorAll<HTMLButtonElement>(".作品切替")) {
        切替.addEventListener("click", () => {
            if (切替.dataset["切替"] === "記法") {
                作品.dataset["記法"] = 作品.dataset["記法"] === "tags" ? "ids" : "tags";
            } else {
                作品.dataset["言語"] = 作品.dataset["言語"] === "ローマ字" ? "日本語" : "ローマ字";
            }
            表示を更新(作品, true);
        });
    }
}
