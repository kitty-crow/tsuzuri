export type 処理 = (根: ParentNode) => void;

export function 属性(要素: Element, 名前: string): string {
    return 要素.getAttribute(名前)?.trim() ?? "";
}

export function 置換(根: ParentNode, 選択子: string, 変換: (要素: Element) => Node): void {
    for (const 要素 of Array.from(根.querySelectorAll(選択子))) {
        if (!要素.isConnected) continue;
        要素.replaceWith(変換(要素));
    }
}

export function 包む(要素: Element, 種類: string): HTMLElement {
    const 箱 = document.createElement("span");
    箱.className = 種類;
    箱.lang = "ja";
    while (要素.firstChild) 箱.append(要素.firstChild);
    return 箱;
}

export function 開始(名前: string, 処理一覧: readonly 処理[]): void {
    const 現在 = document.currentScript;
    const 配布元 = 現在 instanceof HTMLScriptElement ? 現在.src : "";
    const 様式先 = 配布元 ? new URL(名前 + ".css", 配布元).href : "";
    if (様式先 && !document.querySelector('link[data-tsuzuri="' + 名前 + '"]')) {
        const 様式 = document.createElement("link");
        様式.rel = "stylesheet";
        様式.href = 様式先;
        様式.dataset.tsuzuri = 名前;
        document.head.append(様式);
    }
    const 描画 = (): void => {
        for (const 対象 of 処理一覧) 対象(document);
    };
    const 起動 = (): void => {
        描画();
        const 監視 = new MutationObserver((変更) => {
            if (!変更.some((記録) => 記録.addedNodes.length > 0)) return;
            描画();
        });
        監視.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.readyState !== "loading") {
        起動();
        return;
    }
    document.addEventListener("DOMContentLoaded", 起動, { once: true });
}

