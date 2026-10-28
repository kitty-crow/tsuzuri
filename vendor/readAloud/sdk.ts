import { SPEECH_SDK_PATH } from "./config.ts";
import type { SpeechSdkNamespace } from "./types.ts";

/** 出典: kittyCrypto-gg/website/src/readAloud/sdk.ts。サイト固有の読込器を取り除く。 */
export function speechSdkReady(): Promise<SpeechSdkNamespace> {
    if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
    if (window._speechSDKReadyPromise) return window._speechSDKReadyPromise;
    window._speechSDKReadyPromise = new Promise<SpeechSdkNamespace>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SPEECH_SDK_PATH;
        script.async = true;
        script.addEventListener("load", () => {
            const sdk = window.SpeechSDK;
            if (sdk) resolve(sdk);
            if (!sdk) reject(new Error("音声 SDK のスクリプトは読み込まれましたが、Azure の実行環境が見つかりません。"));
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("同梱の Azure 音声 SDK を読み込めませんでした。サイトの音声SDK.jsが遮断されていないか確認してください。")), { once: true });
        document.head.append(script);
    }).catch((error: unknown) => {
        window._speechSDKReadyPromise = null;
        throw error;
    });
    return window._speechSDKReadyPromise;
}
