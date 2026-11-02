/** Runs only when the reader activates their bookmark on the source website. */
function capture(readerAddress: string): void {
    const token = crypto.randomUUID();
    const target = new URL(readerAddress);
    target.searchParams.set("w", location.href);
    target.searchParams.set("capture", token);
    const popup = window.open(target.href, "_blank");
    if (!popup) { alert("綴りのポップアップを許可してください。"); return; }
    const receive = (event: MessageEvent): void => {
        if (event.source !== popup || event.origin !== target.origin || event.data?.type !== "tsuzuri-ready" || event.data?.token !== token) return;
        window.removeEventListener("message", receive);
        popup.postMessage({ type: "tsuzuri-source", token, url: location.href, html: document.documentElement.outerHTML }, target.origin);
    };
    window.addEventListener("message", receive);
    setTimeout(() => window.removeEventListener("message", receive), 60000);
}

export function bookmarklet(readerAddress: string): string {
    return "javascript:void(" + capture.toString() + "(" + JSON.stringify(readerAddress) + "))";
}
