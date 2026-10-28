/** 紹介ページ専用の Ko-fi 接続。綴り本体とは無関係。 */
export {};

type 浮動ウィジェット = Readonly<{
    draw: (名前: string, 設定: Readonly<Record<string, string>>) => void;
}>;

declare global {
    interface Window {
        kofiWidgetOverlay?: 浮動ウィジェット;
    }
}

const 配信元 = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
const 小画面 = window.matchMedia("(max-width: 720px)");
const 消去先 = [
    ".floatingchat-container-wrap", ".floatingchat-container-wrap-mobi",
    ".floating-chat-kofi-popup-iframe", ".floating-chat-kofi-popup-iframe-mobi",
    ".floating-chat-kofi-popup-iframe-closer", ".floating-chat-kofi-popup-iframe-closer-mobi",
].join(", ");

function ウィジェットを消す(): void {
    document.querySelectorAll(消去先).forEach((要素) => 要素.remove());
    document.documentElement.dataset.kofiReady = "false";
}

function 描画する(): void {
    if (!小画面.matches) return;
    if (!window.kofiWidgetOverlay) return;
    ウィジェットを消す();
    window.kofiWidgetOverlay.draw("kittycrow", {
        type: "floating-chat",
        "floating-chat.donateButton.text": "",
        "floating-chat.donateButton.background-color": "#5bc0de",
        "floating-chat.donateButton.text-color": "#323842",
    });
    document.documentElement.dataset.kofiReady = "true";
}

function 読み込む(): void {
    if (window.kofiWidgetOverlay) {
        描画する();
        return;
    }
    if (document.querySelector('script[data-kofi-script="true"]')) return;
    const 読込 = document.createElement("script");
    読込.src = 配信元;
    読込.async = true;
    読込.dataset.kofiScript = "true";
    読込.addEventListener("load", 描画する, { once: true });
    読込.addEventListener("error", () => 読込.remove(), { once: true });
    document.body.append(読込);
}

function 表示を更新(): void {
    if (!小画面.matches) {
        ウィジェットを消す();
        return;
    }
    読み込む();
}

小画面.addEventListener("change", 表示を更新);
表示を更新();
