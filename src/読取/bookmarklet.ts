/** Runs only when the reader activates their bookmark on the source website. */
function capture(readerAddress: string): void {
    const token = crypto.randomUUID();
    const sourceAddress = location.href;
    const target = new URL(readerAddress);
    target.searchParams.set("w", sourceAddress);
    target.searchParams.set("capture", token);
    const popup = window.open(target.href, "_blank");
    if (!popup) { alert("綴りのポップアップを許可してください。"); return; }
    const html = document.documentElement.outerHTML;
    const cleanup = (): void => { clearTimeout(timer); window.removeEventListener("message", receive); };
    const receive = (event: MessageEvent): void => {
        if (event.source !== popup || event.origin !== target.origin || event.data?.token !== token) return;
        if (event.data?.type === "tsuzuri-received") { cleanup(); return; }
        if (event.data?.type !== "tsuzuri-ready") return;
        popup.postMessage({ type: "tsuzuri-source", token, url: sourceAddress, html }, target.origin);
    };
    window.addEventListener("message", receive);
    const timer = setTimeout(cleanup, 120000);
}

export function bookmarklet(readerAddress: string): string {
    return "javascript:void(" + capture.toString() + "(" + JSON.stringify(readerAddress) + "))";
}
