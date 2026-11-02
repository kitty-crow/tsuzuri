import { ENGINE, type PageStore, type SavedPage } from "./types.ts";

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 24;

function savedPage(value: unknown): value is SavedPage {
    if (typeof value !== "object" || value === null) return false;
    return "engine" in value && value.engine === ENGINE && "key" in value && typeof value.key === "string"
        && "html" in value && typeof value.html === "string" && "source" in value && typeof value.source === "string"
        && "url" in value && typeof value.url === "string" && "baseURL" in value && typeof value.baseURL === "string"
        && "plans" in value && Array.isArray(value.plans) && value.plans.every((plan: unknown) => typeof plan === "object" && plan !== null && "mode" in plan && (plan.mode === "vertical" || plan.mode === "horizontal"))
        && "created" in value && typeof value.created === "number" && "bytes" in value && typeof value.bytes === "number"
        && "accessed" in value && typeof value.accessed === "number" && "model" in value && typeof value.model === "string";
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        operation.onsuccess = () => resolve(operation.result);
        operation.onerror = () => reject(operation.error ?? new Error("保存に失敗しました。"));
    });
}

function complete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error("保存を中断しました。"));
        transaction.onerror = () => reject(transaction.error ?? new Error("保存に失敗しました。"));
    });
}

/** IndexedDB stores the compiled artefact and IR, not merely the downloaded HTML. */
export class ReaderCache implements PageStore {
    private connection: Promise<IDBDatabase> | undefined;
    private open(): Promise<IDBDatabase> {
        this.connection ??= this.connect().catch((error: unknown) => { this.connection = undefined; throw error; });
        return this.connection;
    }
    private connect(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const opening = indexedDB.open("tsuzuri-reader", 1);
            opening.onupgradeneeded = () => opening.result.createObjectStore("pages", { keyPath: "key" });
            opening.onsuccess = () => { opening.result.onversionchange = () => opening.result.close(); resolve(opening.result); };
            opening.onerror = () => reject(opening.error);
            opening.onblocked = () => reject(new Error("保存先を開けません。"));
        });
    }
    async get(key: string): Promise<SavedPage | undefined> {
        const db = await this.open();
        const transaction = db.transaction("pages", "readwrite");
        const finished = complete(transaction);
        const store = transaction.objectStore("pages");
        const raw: unknown = await request(store.get(key));
        const page = savedPage(raw) && raw.key === key ? raw : undefined;
        if (page) store.put({ ...page, accessed: Date.now() });
        if (raw && !page) store.delete(key);
        await finished;
        return page;
    }
    async put(page: SavedPage): Promise<void> {
        if (page.bytes > MAX_BYTES / 2) throw new Error("組版結果が保存上限を超えています。");
        const db = await this.open();
        const transaction = db.transaction("pages", "readwrite");
        const finished = complete(transaction);
        const store = transaction.objectStore("pages");
        const existing: unknown[] = await request(store.getAll());
        const pages = existing.filter(savedPage).filter((entry) => entry.key !== page.key).sort((a, b) => b.accessed - a.accessed);
        let bytes = page.bytes;
        let count = 1;
        store.put(page);
        for (const entry of pages) {
            bytes += entry.bytes;
            count++;
            if (bytes > MAX_BYTES || count > MAX_ENTRIES || entry.engine !== ENGINE) store.delete(entry.key);
        }
        await finished;
    }
    async delete(key: string): Promise<void> {
        const db = await this.open();
        const transaction = db.transaction("pages", "readwrite");
        const finished = complete(transaction);
        transaction.objectStore("pages").delete(key);
        await finished;
    }
}
