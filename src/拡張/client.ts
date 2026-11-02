/// <reference types="chrome" />
import { isCapture, type StoredCapture } from "./protocol.ts";

export function extensionReader(): boolean { return location.protocol === "chrome-extension:"; }
export async function extensionSnapshot(id: string): Promise<StoredCapture> {
    const key = "capture:" + id;
    const result = await chrome.storage.session.get(key);
    const value: unknown = result[key];
    if (!isCapture(value) || value.id !== id) throw new Error("元のページの記録が見つかりません。元のタブで拡張機能をもう一度押してください。");
    return value;
}
export async function recapture(tabId: number): Promise<void> {
    await chrome.runtime.sendMessage({ type: "capture-tab", tabId });
}
