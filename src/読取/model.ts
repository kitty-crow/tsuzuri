import { scheduleInference, type InferenceLane } from "./scheduler.ts";
import { ModelTransfers } from "./progress.ts";
import { EMBEDDING_POLICY, MODEL, MODEL_REVISION, type ModelFileProgress, type ProgressSink, type ReaderProgress, type SemanticEncoder, type SemanticResult } from "./types.ts";

type Device = "wasm" | "webgpu";
type GPUAccess = Readonly<{ requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> }>;
type Pending = { resolve: (value: readonly (readonly number[])[]) => void; reject: (error: unknown) => void; timer: ReturnType<typeof setTimeout> };
type DownloadSink = (device: Device, progress: ModelFileProgress) => void;
type WorkerReply = { id: number; error?: string; vectors?: readonly (readonly number[])[] } | { progress: ModelFileProgress };

class ModelLane implements InferenceLane {
    readonly initialBatch: number;
    readonly maximumBatch: number;
    private worker: Worker | undefined;
    private id = 0;
    private pending = new Map<number, Pending>();
    private readonly lifetime = new AbortController();
    private failure: Error | undefined;
    constructor(readonly name: string, private readonly url: URL, private readonly device: Device, private readonly download?: DownloadSink) {
        this.initialBatch = device === "webgpu" ? 8 : 2;
        this.maximumBatch = device === "webgpu" ? 24 : 6;
    }
    async initialise(): Promise<void> {
        this.worker = new Worker(this.url, { type: "module" });
        this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
            if ("progress" in event.data) { this.download?.(this.device, event.data.progress); return; }
            const pending = this.pending.get(event.data.id);
            if (!pending) return;
            clearTimeout(pending.timer); this.pending.delete(event.data.id);
            if (event.data.error) { pending.reject(new Error(event.data.error)); return; }
            pending.resolve(event.data.vectors ?? []);
        };
        this.worker.onerror = (event) => this.fail(new Error(event.message || "解析ワーカーが停止しました。"));
        // 同じ装置の初期化を直列化し、先行ワーカーが保存した重みを再利用する。
        const load = async (): Promise<void> => { await this.send({ kind: "initialise", device: this.device }, 180000); };
        if (navigator.locks) { await navigator.locks.request("tsuzuri-model-" + MODEL_REVISION + "-" + this.device, { signal: this.lifetime.signal }, load); return; }
        await load();
    }
    run(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
        return this.send({ kind: "encode", texts }, 60000);
    }
    close(): void {
        this.lifetime.abort();
        this.worker?.terminate(); this.worker = undefined;
        this.fail(new DOMException("Worker closed", "AbortError"));
    }
    private fail(error: Error): void {
        this.failure = error;
        for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
        this.pending.clear();
    }
    private send(message: object, timeout: number): Promise<readonly (readonly number[])[]> {
        if (this.failure || !this.worker) return Promise.reject(this.failure ?? new Error("解析ワーカーが停止しています。"));
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("意味解析が時間内に完了しませんでした。")); }, timeout);
            this.pending.set(id, { resolve, reject, timer });
            this.worker?.postMessage({ ...message, id });
        });
    }
}

/** WASMの初期化と並行してWebGPUの利用可否を調べる。 */
class GPULane implements InferenceLane {
    readonly name = "webgpu";
    readonly initialBatch = 8;
    readonly maximumBatch = 24;
    private inner: ModelLane | undefined;
    private closed = false;
    constructor(private readonly url: URL, private readonly gpu: GPUAccess, private readonly download?: DownloadSink) {}
    async initialise(): Promise<void> {
        const adapter = await Promise.race([this.gpu.requestAdapter(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))]);
        if (!adapter || this.closed) throw new Error("WebGPUを利用できません。");
        this.inner = new ModelLane("webgpu", this.url, "webgpu", this.download);
        await this.inner.initialise();
    }
    run(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
        if (!this.inner) return Promise.reject(new Error("WebGPUが準備できていません。"));
        return this.inner.run(texts);
    }
    close(): void { this.closed = true; this.inner?.close(); }
}

export class LocalEncoder implements SemanticEncoder {
    constructor(private readonly workerURL: URL) {}
    async encode(texts: readonly string[], signal: AbortSignal, progress?: ProgressSink): Promise<SemanticResult> {
        signal.throwIfAborted();
        const transfers = new ModelTransfers();
        let latest: ReaderProgress = { phase: "model", etaSeconds: null };
        progress?.(latest);
        const download: DownloadSink = (device, event) => {
            const transfer = transfers.update(device, event, performance.now());
            if (signal.aborted || !transfer) return;
            latest = { ...latest, download: transfer };
            progress?.(latest);
        };
        const hardware = navigator as Navigator & { deviceMemory?: number; gpu?: GPUAccess };
        const cores = hardware.hardwareConcurrency || 2;
        const memory = hardware.deviceMemory ?? 4;
        const cpuCount = texts.length < 24 ? 1 : Math.max(1, Math.min(3, Math.floor((cores - 2) / 2), Math.floor(memory / 3)));
        const lanes: InferenceLane[] = Array.from({ length: cpuCount }, (_, index) => new ModelLane("wasm-" + String(index), this.workerURL, "wasm", download));
        if (hardware.gpu) lanes.push(new GPULane(this.workerURL, hardware.gpu, download));
        const vectors = await scheduleInference(texts, lanes, signal, () => performance.now(), (value) => {
            latest = { ...latest, phase: "analyse", ...value };
            progress?.(latest);
        });
        return { vectors, model: MODEL + "@" + MODEL_REVISION + ":" + EMBEDDING_POLICY };
    }
}
