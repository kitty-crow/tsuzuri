import type { ModelFileProgress, TransferProgress } from "./types.ts";

/** 処理量と経過時間から速度と残り時間を推定する。 */
export class Throughput {
    private amount = 0;
    private time: number | undefined;
    private rate = 0;
    observe(amount: number, now: number): void {
        const elapsed = this.time === undefined ? 0 : now - this.time;
        const delta = amount - this.amount;
        if (elapsed > 0 && delta > 0) this.rate = this.rate ? this.rate * 0.65 + delta / elapsed * 0.35 : delta / elapsed;
        if (delta > 0 || this.time === undefined) { this.amount = amount; this.time = now; }
    }
    remaining(total: number, now: number): number | null {
        if (total > 0 && this.amount >= total) return 0;
        if (!this.rate || this.time === undefined || now - this.time > 10000 || total <= 0) return null;
        return Math.max(0, total - this.amount) / this.rate / 1000;
    }
}

/** 同じ装置・同じファイルの読込報告は重複して加算しない。 */
export class ModelTransfers {
    private files = new Map<string, { loaded: number; total: number }>();
    private throughput = new Throughput();
    update(backend: string, event: ModelFileProgress, now: number): TransferProgress | undefined {
        const key = backend + ":" + event.file;
        const previous = this.files.get(key) ?? { loaded: 0, total: 0 };
        const total = Math.max(previous.total, Number.isFinite(event.total) ? event.total : 0);
        const amount = Number.isFinite(event.loaded) ? Math.max(0, event.loaded) : 0;
        const loaded = event.status === "done" ? total : Math.max(previous.loaded, Math.min(amount, total));
        this.files.set(key, { loaded, total });
        const values = Array.from(this.files.values());
        const sum = values.reduce((result, value) => ({ loaded: result.loaded + value.loaded, total: result.total + value.total }), { loaded: 0, total: 0 });
        this.throughput.observe(sum.loaded, now);
        if (!sum.total) return undefined;
        return { ...sum, etaSeconds: this.throughput.remaining(sum.total, now) };
    }
}

export function duration(seconds: number): string {
    const value = Math.max(1, Math.ceil(seconds));
    if (value < 60) return String(value) + "秒";
    return String(Math.floor(value / 60)) + "分" + String(value % 60).padStart(2, "0") + "秒";
}
