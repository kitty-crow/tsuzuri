/// <reference types="chrome" />
import { sourceURL } from "../読取/query.ts";
import { isCapture, type PageCapture, type StoredCapture } from "./protocol.ts";

async function capture(tabId: number, readerTabId?: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: "…" });
    try {
        const source = await chrome.tabs.get(tabId);
        sourceURL(source.url ?? "");
        await chrome.scripting.executeScript({ target: { tabId }, files: ["capture.js"], world: "ISOLATED" });
        const results = await chrome.scripting.executeScript({ target: { tabId }, world: "ISOLATED", func: (): PageCapture => {
            const fn = (globalThis as typeof globalThis & { __tsuzuriCapture?: () => PageCapture }).__tsuzuriCapture;
            if (!fn) throw new Error("ページを読み込めませんでした。");
            return fn();
        } });
        const result = results.find((item) => item.frameId === 0)?.result;
        const packet: unknown = { ...result, id: crypto.randomUUID(), sourceTabId: tabId, capturedAt: Date.now() };
        if (!isCapture(packet)) throw new Error("ページを読み込めませんでした。");
        if (new TextEncoder().encode(JSON.stringify(packet)).byteLength > 4 * 1024 * 1024) throw new Error("解析するページが大きすぎます。");
        sourceURL(packet.url);
        const stored = await chrome.storage.session.get("capture-index");
        const index: string[] = Array.isArray(stored["capture-index"]) ? stored["capture-index"].filter((value: unknown): value is string => typeof value === "string") : [];
        await chrome.storage.session.remove(index.slice(1).map((id) => "capture:" + id));
        await chrome.storage.session.set({ ["capture:" + packet.id]: packet satisfies StoredCapture, "capture-index": [packet.id, ...index.slice(0, 1)] });
        const url = chrome.runtime.getURL("index.html") + "?w=" + encodeURIComponent(packet.url) + "&snapshot=" + packet.id;
        if (readerTabId !== undefined) { await chrome.tabs.update(readerTabId, { url }); return; }
        await chrome.tabs.create({ url });
    } finally { await chrome.action.setBadgeText({ tabId, text: "" }); }
}

async function launch(tabId: number, readerTabId?: number): Promise<void> {
    try { await capture(tabId, readerTabId); }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const url = chrome.runtime.getURL("index.html") + "?error=" + encodeURIComponent("ページを開けませんでした。通常のウェブサイトを開いて、もう一度実行してください。 " + message);
        if (readerTabId !== undefined) { await chrome.tabs.update(readerTabId, { url }); return; }
        await chrome.tabs.create({ url });
    }
}

chrome.action.onClicked.addListener((tab) => { if (tab.id !== undefined) void launch(tab.id); });
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;
    if (typeof message !== "object" || message === null || !("type" in message) || message.type !== "capture-tab" || !("tabId" in message) || typeof message.tabId !== "number") return false;
    void launch(message.tabId, sender.tab?.id).then(() => respond({ ok: true }));
    return true;
});
