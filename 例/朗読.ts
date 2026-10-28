/** 綴りの物語専用の朗読 UI。移植元の音声キューは vendor/readAloud/ にある。 */
import { AudioQueue } from "../vendor/readAloud/audioQueue.ts";
import { speechSdkReady } from "../vendor/readAloud/sdk.ts";
import { READ_ALOUD_VOICE } from "../vendor/readAloud/config.ts";
import { resolveRegionForKey } from "../vendor/readAloud/regionResolver.ts";
import type { ReadAloudState } from "../vendor/readAloud/types.ts";

const 本文 = document.querySelector<HTMLElement>("#物語本文");
const 再生 = document.querySelector<HTMLButtonElement>("#朗読再生");
const 停止 = document.querySelector<HTMLButtonElement>("#朗読停止");
const 前へ = document.querySelector<HTMLButtonElement>("#朗読前");
const 次へ = document.querySelector<HTMLButtonElement>("#朗読次");
const 設定 = document.querySelector<HTMLDetailsElement>("#朗読設定");
const 鍵 = document.querySelector<HTMLInputElement>("#朗読鍵");
const 鍵表示 = document.querySelector<HTMLButtonElement>("#朗読鍵表示");
const 地域 = document.querySelector<HTMLSelectElement>("#朗読地域");
const 状態 = document.querySelector<HTMLOutputElement>("#朗読状態");

type 朗読環境 = Readonly<{
    本文: HTMLElement;
    再生: HTMLButtonElement;
    停止: HTMLButtonElement;
    前へ: HTMLButtonElement;
    次へ: HTMLButtonElement;
    設定: HTMLDetailsElement;
    鍵: HTMLInputElement;
    鍵表示: HTMLButtonElement;
    地域: HTMLSelectElement;
    状態: HTMLOutputElement;
}>;

const 鍵の保存先 = "綴り-朗読鍵";

function 文字を取る(): string {
    try {
        const 保存済み = localStorage.getItem(鍵の保存先);
        if (保存済み !== null) return 保存済み;
        const 旧 = sessionStorage.getItem(鍵の保存先);
        if (旧 !== null) {
            localStorage.setItem(鍵の保存先, 旧);
            sessionStorage.removeItem(鍵の保存先);
        }
        return 旧 ?? "";
    } catch {
        return "";
    }
}

function 保存(文字: string): void {
    try {
        if (文字) localStorage.setItem(鍵の保存先, 文字);
        else localStorage.removeItem(鍵の保存先);
    } catch {
        // ブラウザーの保存が禁止されても朗読は続けられる。
    }
}

function 段落一覧(根: HTMLElement): HTMLElement[] {
    return Array.from(根.querySelectorAll<HTMLElement>(
        ".物語大題, .物語後日題, .物語年月, .物語小見出し, .物語段落"
    )).filter((要素) => (要素.textContent ?? "").trim().length > 0);
}

class 物語朗読 {
    readonly #画面: 朗読環境;
    readonly #音声: AudioQueue;
    readonly #段落: HTMLElement[];
    #位置 = 0;
    #世代 = 0;
    #再生音: HTMLAudioElement | null = null;
    #音声URL: string | null = null;
    #進行中 = false;

    constructor(画面: 朗読環境) {
        this.#画面 = 画面;
        this.#段落 = 段落一覧(画面.本文);
        window.readAloudState = this.#初期状態();
        this.#音声 = new AudioQueue(speechSdkReady);
        画面.鍵.value = 文字を取る();
        画面.再生.addEventListener("click", () => { void this.#切り替える(); });
        画面.停止.addEventListener("click", () => { void this.#止める(); });
        画面.前へ.addEventListener("click", () => { void this.#移る(-1); });
        画面.次へ.addEventListener("click", () => { void this.#移る(1); });
        画面.鍵.addEventListener("input", () => 保存(画面.鍵.value.trim()));
        画面.鍵表示.addEventListener("click", () => {
            const 見える = 画面.鍵.type === "password";
            画面.鍵.type = 見える ? "text" : "password";
            画面.鍵表示.setAttribute("aria-pressed", String(見える));
            画面.鍵表示.setAttribute("aria-label", 見える ? "キーを隠す" : "キーを表示");
            画面.鍵表示.title = 見える ? "キーを隠す" : "キーを表示";
        });
        画面.地域.addEventListener("change", () => { void this.#止める(); });
        window.addEventListener("pagehide", () => { this.#音を捨てる(); });
        this.#表示する("朗読の準備ができました。");
    }

    #初期状態(): ReadAloudState {
        return {
            paused: true, pressed: false, currentPIdx: 0, currentPid: null,
            paragraphs: this.#段落, synthesiser: null, lastSpokenText: "",
            voiceName: READ_ALOUD_VOICE, speechKey: "", serviceRegion: "",
            speechRate: 1, configVisible: false, menuVisible: true,
            jumpVisible: false, buffer: null, currentAudio: null,
            currentAudioUrl: null, apiKeyVisible: false, regionUiVisible: false,
            MSTimer: null, MStoken: 0, playbackToken: 0,
        };
    }

    #表示する(言葉: string): void {
        this.#画面.状態.textContent = 言葉;
        this.#画面.再生.textContent = this.#進行中 ? "一時停止" : "再生";
        this.#画面.再生.setAttribute("aria-pressed", String(this.#進行中));
        this.#画面.停止.disabled = !this.#進行中 && this.#位置 === 0;
        this.#画面.前へ.disabled = this.#位置 === 0;
        this.#画面.次へ.disabled = this.#位置 >= this.#段落.length - 1;
    }

    #音を捨てる(): void {
        this.#再生音?.pause();
        this.#再生音?.removeAttribute("src");
        this.#再生音?.load();
        this.#再生音 = null;
        if (this.#音声URL) URL.revokeObjectURL(this.#音声URL);
        this.#音声URL = null;
    }

    async #止める(): Promise<void> {
        this.#世代 += 1;
        this.#進行中 = false;
        window.readAloudState.paused = true;
        this.#音を捨てる();
        this.#位置 = 0;
        this.#段落.forEach((段落) => 段落.classList.remove("朗読中"));
        this.#表示する("朗読を停止しました。");
        await this.#音声.reset();
    }

    async #移る(増減: number): Promise<void> {
        const 次 = Math.max(0, Math.min(this.#段落.length - 1, this.#位置 + 増減));
        if (次 === this.#位置) return;
        this.#世代 += 1;
        this.#音を捨てる();
        this.#位置 = 次;
        this.#段落.forEach((段落) => 段落.classList.remove("朗読中"));
        if (!this.#進行中) {
            this.#表示する("段落 " + String(次 + 1) + " / " + String(this.#段落.length));
            return;
        }
        void this.#読み進む(this.#世代);
    }

    /** 地域の入力がなければ移植元と同じ voice-list API で確認する。 */
    async #地域を決める(キー: string): Promise<string | null> {
        const 指定 = this.#画面.地域.value;
        if (指定) return 指定;

        this.#表示する("Azure Speech の地域を自動検出しています。");
        const 結果 = await resolveRegionForKey(キー, "uksouth");
        if (結果.region) {
            this.#表示する("音声の地域を検出しました: " + 結果.region);
            return 結果.region;
        }

        const 理由: Readonly<Record<string, string>> = {
            no_key: "Azure のキーが入力されていません。",
            rate_limited: "Azure の地域確認が制限されました（HTTP 429）。時間をおいてお試しください。",
            network_error: "地域確認の通信が遮断されました。手動で英国南部（uksouth）を選択できます。",
            not_found: "キーに対応する Azure Speech の地域を確認できませんでした。手動で地域を指定できます。",
            ok: "地域の確認結果を取得できませんでした。",
            cached: "地域の確認結果を取得できませんでした。",
            locked: "地域の確認結果を取得できませんでした。",
        };
        this.#進行中 = false;
        window.readAloudState.paused = true;
        this.#画面.設定.open = true;
        this.#表示する(理由[結果.reason] ?? "地域の確認に失敗しました。");
        return null;
    }

    #失敗の表示(原因: unknown): void {
        const 説明 = 原因 instanceof Error ? 原因.message
            : typeof 原因 === "string" ? 原因 : "原因を特定できませんでした。";
        const 鍵の文字 = this.#画面.鍵.value.trim();
        const 安全な内容 = 鍵の文字 ? 説明.replaceAll(鍵の文字, "[秘匿]") : 説明;
        this.#表示する("朗読に失敗しました: " + 安全な内容.slice(0, 350));
        this.#画面.設定.open = true;
    }

    async #切り替える(): Promise<void> {
        if (this.#進行中) {
            this.#進行中 = false;
            window.readAloudState.paused = true;
            this.#再生音?.pause();
            this.#表示する("一時停止しました。");
            return;
        }

        const キー = this.#画面.鍵.value.trim();
        if (!キー) {
            this.#画面.設定.open = true;
            this.#画面.鍵.focus();
            this.#表示する("Azure Speech のキーと地域を入力してください。");
            return;
        }
        保存(キー);
        const 前状態 = window.readAloudState;
        前状態.speechKey = キー;
        前状態.voiceName = READ_ALOUD_VOICE;
        前状態.paused = false;
        this.#進行中 = true;
        this.#表示する("Azure の日本語音声を準備しています。");
        if (this.#再生音) {
            try {
                await this.#再生音.play();
            } catch (原因: unknown) {
                this.#進行中 = false;
                this.#失敗の表示(原因);
                return;
            }
            this.#表示する("朗読中");
            return;
        }
        const 世代 = ++this.#世代;
        const 使用地域 = await this.#地域を決める(キー);
        if (世代 !== this.#世代 || !使用地域) return;
        前状態.serviceRegion = 使用地域;
        this.#表示する("Azure の日本語音声を準備しています: " + 使用地域);
        void this.#読み進む(世代);
    }

    async #読み進む(世代: number): Promise<void> {
        if (世代 !== this.#世代 || !this.#進行中) return;
        if (this.#位置 >= this.#段落.length) {
            await this.#止める();
            this.#表示する("最後まで読み終えました。");
            return;
        }
        const 対象 = this.#段落[this.#位置];
        if (!対象) return;
        window.readAloudState.currentPIdx = this.#位置;
        this.#段落.forEach((段落) => 段落.classList.toggle("朗読中", 段落 === 対象));
        対象.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        this.#表示する("朗読中 " + String(this.#位置 + 1) + " / " + String(this.#段落.length));
        try {
            await this.#音声.sync();
            const 音源 = await this.#音声.buffer(this.#位置);
            if (世代 !== this.#世代 || !this.#進行中 || !音源) return;
            this.#音声.warm(this.#位置 + 1);
            this.#音声URL = URL.createObjectURL(new Blob([音源.audioData], { type: "audio/mpeg" }));
            const 音 = new Audio(this.#音声URL);
            this.#再生音 = 音;
            音.addEventListener("ended", () => {
                if (世代 !== this.#世代) return;
                this.#音を捨てる();
                this.#位置 += 1;
                void this.#読み進む(世代);
            }, { once: true });
            音.addEventListener("error", () => {
                if (世代 !== this.#世代) return;
                this.#進行中 = false;
                this.#表示する("合成された音声を再生できませんでした。");
            }, { once: true });
            await 音.play();
        } catch (原因: unknown) {
            if (世代 !== this.#世代) return;
            this.#進行中 = false;
            window.readAloudState.paused = true;
            this.#音を捨てる();
            this.#失敗の表示(原因);
        }
    }
}

/** 目次と同じく、非固定では本文に重ね、固定した場合のみ本文を押し下げる。 */
function 朗読の収納を起動(): void {
    const 収納 = document.querySelector<HTMLElement>(".朗読収納");
    const 引手 = document.querySelector<HTMLButtonElement>("#朗読引手");
    const 固定 = document.querySelector<HTMLButtonElement>("#朗読固定");
    if (!収納 || !引手 || !固定) return;

    const 保存先 = "綴り-物語朗読固定";
    let 初期固定 = false;
    try {
        初期固定 = window.localStorage.getItem(保存先) === "true";
    } catch {
        // ローカルの保存が禁止されていても操作は可能。
    }

    const 開きを更新 = (): void => {
        const 開く = 収納.dataset.readaloudPinned === "true"
            || 収納.dataset.readaloudOpen === "true"
            || 収納.matches(":hover, :focus-within");
        引手.setAttribute("aria-expanded", String(開く));
        引手.setAttribute("aria-label", 開く ? "朗読の操作を閉じる" : "朗読の操作を開く");
    };
    const 固定を適用 = (固定する: boolean): void => {
        収納.dataset.readaloudPinned = String(固定する);
        固定.setAttribute("aria-pressed", String(固定する));
        固定.setAttribute("aria-label", 固定する ? "朗読の固定を解除する" : "朗読の操作を固定する");
        固定.title = 固定.getAttribute("aria-label") ?? "";
        開きを更新();
    };

    固定を適用(初期固定);
    固定.addEventListener("click", () => {
        const 次 = 収納.dataset.readaloudPinned !== "true";
        固定を適用(次);
        try {
            window.localStorage.setItem(保存先, String(次));
        } catch {
            // 保存できなくても現在の表示は維持する。
        }
    });
    引手.addEventListener("click", () => {
        収納.dataset.readaloudOpen = String(収納.dataset.readaloudOpen !== "true");
        開きを更新();
    });
    収納.addEventListener("pointerenter", 開きを更新);
    収納.addEventListener("pointerleave", 開きを更新);
    収納.addEventListener("focusin", 開きを更新);
    収納.addEventListener("focusout", () => requestAnimationFrame(開きを更新));
    収納.addEventListener("keydown", (出来事: KeyboardEvent) => {
        if (出来事.key !== "Escape") return;
        収納.dataset.readaloudOpen = "false";
        if (収納.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        開きを更新();
    });
}

朗読の収納を起動();

if (本文 && 再生 && 停止 && 前へ && 次へ && 設定 && 鍵 && 鍵表示 && 地域 && 状態) {
    new 物語朗読({ 本文, 再生, 停止, 前へ, 次へ, 設定, 鍵, 鍵表示, 地域, 状態 });
}
