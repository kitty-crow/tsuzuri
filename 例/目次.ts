/** 紹介ページの目次だけを動かす。配布ライブラリーには含めない。 */
const 巻 = document.querySelector<HTMLElement>("#物語本文");
const 目次 = document.querySelector<HTMLElement>("#物語目次");

function 目次の移動(対象: Element, 動作: ScrollBehavior): void {
    if (!巻) return;
    const 窓 = 巻.getBoundingClientRect();
    const 場所 = 対象.getBoundingClientRect();
    const ずれ = 場所.right - (窓.right - 28);
    巻.scrollTo({ left: 巻.scrollLeft + ずれ, behavior: 動作 });
}

function 現在地を示す(リンク: readonly HTMLAnchorElement[], 見出し: readonly Element[]): void {
    if (!巻) return;
    const 境界 = 巻.getBoundingClientRect().right - 22;
    const 現在 = 見出し.find((要素) => 要素.getBoundingClientRect().right <= 境界);
    const 識別 = 現在?.id ?? 見出し[0]?.id;
    for (const 項目 of リンク) {
        if (項目.dataset.target === 識別) 項目.setAttribute("aria-current", "location");
        if (項目.dataset.target !== 識別) 項目.removeAttribute("aria-current");
    }
}

/** 開閉の見た目は CSS に任せ、固定状態だけを保存する。 */
const 固定保存先 = "綴り-物語目次固定";

function 固定を読む(): boolean {
    try {
        return window.localStorage.getItem(固定保存先) === "true";
    } catch {
        return false;
    }
}

function 固定を保存(固定: boolean): void {
    try {
        window.localStorage.setItem(固定保存先, String(固定));
    } catch {
        /* 保存が使えなくても現在の操作は維持する。 */
    }
}

function 目次収納を起動(本文: HTMLElement, 案内: HTMLElement): void {
    const 読書面 = 本文.closest<HTMLElement>(".物語読書面");
    const 側 = 案内.closest<HTMLElement>(".目次側");
    const 固定ボタン = document.querySelector<HTMLButtonElement>("#目次固定");
    const 引手 = document.querySelector<HTMLButtonElement>("#目次引手");
    if (!読書面 || !側 || !固定ボタン || !引手) return;

    const 開き状態を更新 = (): void => {
        const 開いた = 読書面.dataset.indexPinned === "true"
            || 読書面.dataset.indexOpen === "true"
            || 側.matches(":hover, :focus-within");
        引手.setAttribute("aria-expanded", String(開いた));
        引手.setAttribute("aria-label", 開いた ? "目次を閉じる" : "目次を開く");
    };
    const 固定を適用 = (固定: boolean): void => {
        読書面.dataset.indexPinned = String(固定);
        固定ボタン.setAttribute("aria-pressed", String(固定));
        固定ボタン.setAttribute("aria-label", 固定 ? "目次の固定を解除する" : "目次を固定する");
        固定ボタン.title = 固定ボタン.getAttribute("aria-label") ?? "";
        開き状態を更新();
    };

    固定を適用(固定を読む());
    固定ボタン.addEventListener("click", () => {
        const 固定 = 読書面.dataset.indexPinned !== "true";
        固定を適用(固定);
        固定を保存(固定);
    });
    引手.addEventListener("click", () => {
        読書面.dataset.indexOpen = String(読書面.dataset.indexOpen !== "true");
        開き状態を更新();
    });
    側.addEventListener("pointerenter", 開き状態を更新);
    側.addEventListener("pointerleave", 開き状態を更新);
    側.addEventListener("focusin", 開き状態を更新);
    側.addEventListener("focusout", () => requestAnimationFrame(開き状態を更新));
    document.addEventListener("keydown", (出来事: KeyboardEvent) => {
        if (出来事.key !== "Escape") return;
        読書面.dataset.indexOpen = "false";
        if (側.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        開き状態を更新();
    });
}

/** 物語の上では上下の車輪操作を右から左へ読む巻物の移動に変換する。 */
function 巻物の車輪を起動(本文: HTMLElement): void {
    本文.addEventListener("wheel", (出来事: WheelEvent) => {
        if (出来事.ctrlKey || 出来事.metaKey) return;
        if (Math.abs(出来事.deltaX) > Math.abs(出来事.deltaY)) return;
        if (出来事.deltaY === 0) return;

        const 倍率 = 出来事.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
            : 出来事.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 本文.clientWidth : 1;
        const 移動量 = 出来事.deltaY * 倍率;
        const 左端 = Math.min(0, 本文.clientWidth - 本文.scrollWidth);
        const 現在 = Math.min(0, Math.max(左端, 本文.scrollLeft));
        const 次 = Math.min(0, Math.max(左端, 現在 - 移動量));
        if (Math.abs(次 - 現在) < .5) return;

        出来事.preventDefault();
        本文.scrollLeft = 次;
    }, { passive: false });
}

function 目次を起動(本文: HTMLElement, 案内: HTMLElement): void {
    目次収納を起動(本文, 案内);
    巻物の車輪を起動(本文);
    const リンク = Array.from(案内.querySelectorAll<HTMLAnchorElement>("a[data-target]"));
    const 見出し = リンク.flatMap((項目) => {
        const 識別 = 項目.dataset.target;
        const 対象 = 識別 ? document.getElementById(識別) : null;
        return 対象 && 本文.contains(対象) ? [対象] : [];
    });
    案内.addEventListener("click", (出来事: MouseEvent) => {
        const クリック = 出来事.target;
        if (!(クリック instanceof Element)) return;
        const リンク先 = クリック.closest<HTMLAnchorElement>("a[data-target]");
        if (!リンク先 || !案内.contains(リンク先)) return;
        const 識別 = リンク先.dataset.target;
        const 対象 = 識別 ? document.getElementById(識別) : null;
        if (!対象 || !本文.contains(対象)) return;
        出来事.preventDefault();
        const 控えめ = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        目次の移動(対象, 控えめ ? "instant" : "smooth");
        window.history.replaceState(window.history.state, "", "#" + encodeURIComponent(対象.id));
        リンク先.focus({ preventScroll: true });
    });
    let 予約中 = false;
    const 更新 = (): void => {
        if (予約中) return;
        予約中 = true;
        requestAnimationFrame(() => {
            予約中 = false;
            現在地を示す(リンク, 見出し);
        });
    };
    本文.addEventListener("scroll", 更新, { passive: true });
    window.addEventListener("resize", 更新, { passive: true });
    更新();
    const 開始点 = decodeURIComponent(window.location.hash.slice(1));
    const 開始見出し = document.getElementById(開始点);
    if (!開始見出し || !本文.contains(開始見出し)) return;
    requestAnimationFrame(() => 目次の移動(開始見出し, "instant"));
}

if (巻 && 目次) 目次を起動(巻, 目次);
