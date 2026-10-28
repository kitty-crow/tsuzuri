/** 出典: kittyCrypto-gg/website/src/readAloud/speechResource.ts。
 * 鍵は要求のヘッダーにだけ付け、ブラウザーの永続記憶には保存しない。
 */
import { READ_ALOUD_REGIONS } from "./config.ts";
import type { RegionProbeResult, RegionResolveResult } from "./types.ts";

export async function probeRegionForKey(鍵: string, 地域: string): Promise<RegionProbeResult> {
    if (!鍵 || !地域) return { ok: false, status: 0 };
    const 中止 = new AbortController();
    const 時限 = window.setTimeout(() => 中止.abort(), 3500);
    try {
        const 回答 = await fetch(
            "https://" + 地域 + ".tts.speech.microsoft.com/cognitiveservices/voices/list",
            { method: "GET", headers: { "Ocp-Apim-Subscription-Key": 鍵 }, signal: 中止.signal },
        );
        return { ok: 回答.ok, status: 回答.status };
    } catch {
        return { ok: false, status: 0 };
    } finally {
        window.clearTimeout(時限);
    }
}

function 休む(間隔: number): Promise<void> {
    return new Promise<void>((完了) => window.setTimeout(完了, 間隔));
}

export async function resolveRegionForKey(鍵: string, 優先地域 = ""): Promise<RegionResolveResult> {
    if (!鍵) return { region: null, reason: "no_key" };
    const 地域一覧: readonly string[] = 優先地域
        ? [優先地域, ...READ_ALOUD_REGIONS.filter((地域) => 地域 !== 優先地域)]
        : READ_ALOUD_REGIONS;
    let 通信失敗 = 0;
    for (const 地域 of 地域一覧) {
        const 結果 = await probeRegionForKey(鍵, 地域);
        if (結果.ok) return { region: 地域, reason: "ok" };
        if (結果.status === 429) return { region: null, reason: "rate_limited" };
        if (結果.status === 0) 通信失敗 += 1;
        await 休む(140);
    }
    return {
        region: null,
        reason: 通信失敗 === 地域一覧.length ? "network_error" : "not_found",
    };
}
