/** A lane can be WebGPU or WASM. The scheduler does not depend on browser APIs. */
export interface InferenceLane {
    readonly name: string;
    readonly initialBatch: number;
    readonly maximumBatch: number;
    initialise(): Promise<void>;
    run(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
    close(): void;
}
type Job = Readonly<{ index: number; text: string }>;
type State = { lane: InferenceLane; ready: boolean; busy: boolean; failed: boolean; batch: number; rate: number };
type WorkProgress = Readonly<{ completed: number; total: number; etaSeconds: number | null }>;

/** Work stealing, length bucketing and measured batch sizing keep both devices occupied. */
export function scheduleInference(texts: readonly string[], lanes: readonly InferenceLane[], signal: AbortSignal, clock = (): number => performance.now(), progress?: (value: WorkProgress) => void): Promise<readonly (readonly number[])[]> {
    signal.throwIfAborted();
    if (texts.length === 0) return Promise.resolve([]);
    if (lanes.length === 0) return Promise.reject(new Error("解析装置を利用できません。"));
    return new Promise((resolve, reject) => {
        const jobs: Job[] = texts.map((text, index) => ({ text, index })).sort((a, b) => b.text.length - a.text.length);
        const output: (readonly number[])[] = Array.from({ length: texts.length });
        const states: State[] = lanes.map((lane) => ({ lane, ready: false, busy: false, failed: false, batch: lane.initialBatch, rate: 0 }));
        let completed = 0;
        let completedWork = 0;
        const totalWork = texts.reduce((sum, text) => sum + Math.max(1, text.length), 0);
        let finished = false;
        const report = (): void => {
            const rate = states.filter((state) => !state.failed && (state.busy || jobs.length > 0)).reduce((sum, state) => sum + state.rate, 0);
            const remaining = Math.max(0, totalWork - completedWork);
            progress?.({ completed, total: texts.length, etaSeconds: remaining === 0 ? 0 : rate ? remaining / rate / 1000 : null });
        };
        const finish = (error?: unknown): void => {
            if (finished) return;
            finished = true;
            signal.removeEventListener("abort", abort);
            for (const state of states) state.lane.close();
            if (error) { reject(error); return; }
            resolve(output);
        };
        const abort = (): void => finish(signal.reason ?? new DOMException("Aborted", "AbortError"));
        const pump = (): void => {
            if (finished) return;
            if (completed === texts.length) { finish(); return; }
            if (states.every((state) => state.failed)) { finish(new Error("すべての解析装置が停止しました。")); return; }
            for (const state of states) {
                if (!state.ready || state.busy || state.failed || jobs.length === 0) continue;
                const batch = jobs.splice(0, state.batch);
                state.busy = true;
                const started = clock();
                report();
                void Promise.resolve().then(() => state.lane.run(batch.map((job) => job.text))).then((vectors) => {
                    if (finished) return;
                    if (vectors.length !== batch.length || vectors.some((vector) => vector.length !== 384 || vector.some((value) => !Number.isFinite(value)))) throw new Error("意味解析の出力が不正です。");
                    batch.forEach((job, index) => { output[job.index] = vectors[index]!; });
                    completed += batch.length;
                    const duration = Math.max(1, clock() - started);
                    const work = batch.reduce((sum, job) => sum + Math.max(1, job.text.length), 0);
                    completedWork += work;
                    state.rate = state.rate ? state.rate * 0.65 + work / duration * 0.35 : work / duration;
                    const suggested = batch.length * 150 / duration;
                    state.batch = Math.max(1, Math.min(state.lane.maximumBatch, Math.round((state.batch + suggested) / 2)));
                    state.busy = false;
                    report();
                    pump();
                }).catch(() => {
                    if (finished) return;
                    jobs.unshift(...batch); state.busy = false; state.failed = true; state.lane.close(); report(); pump();
                });
            }
        };
        signal.addEventListener("abort", abort, { once: true });
        for (const state of states) {
            void Promise.resolve().then(() => state.lane.initialise()).then(() => { state.ready = true; pump(); }).catch(() => {
                state.failed = true; state.lane.close(); pump();
            });
        }
    });
}
