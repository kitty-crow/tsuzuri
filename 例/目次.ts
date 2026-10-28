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

function 目次を起動(本文: HTMLElement, 案内: HTMLElement): void {
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
