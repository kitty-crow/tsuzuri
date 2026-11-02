import { describe, expect, test } from "bun:test";
import { ModelTransfers, Throughput, duration } from "../src/読取/progress.ts";
import { scheduleInference, type InferenceLane } from "../src/読取/scheduler.ts";

describe("読書処理の進捗と残り時間", () => {
    test("実測速度から残り時間を推定し、停止時は推定を失効させる", () => {
        const rate = new Throughput();
        rate.observe(0, 0);
        expect(rate.remaining(1000, 0)).toBeNull();
        rate.observe(100, 1000);
        expect(rate.remaining(500, 1000)).toBe(4);
        expect(rate.remaining(500, 12000)).toBeNull();
        rate.observe(500, 13000);
        expect(rate.remaining(500, 13000)).toBe(0);
    });
    test("CPU間の重複報告を除き、GPUのモデルも集計する", () => {
        const transfers = new ModelTransfers();
        transfers.update("wasm", { file: "model", status: "progress", loaded: 0, total: 1000 }, 0);
        expect(transfers.update("wasm", { file: "model", status: "progress", loaded: 500, total: 1000 }, 1000)).toEqual({ loaded: 500, total: 1000, etaSeconds: 1 });
        expect(transfers.update("wasm", { file: "model", status: "progress", loaded: 100, total: 1000 }, 1100)?.loaded).toBe(500);
        expect(transfers.update("webgpu", { file: "model", status: "progress", loaded: 50, total: 2000 }, 1200)?.total).toBe(3000);
        expect(transfers.update("wasm", { file: "model", status: "done", loaded: 0, total: 0 }, 1300)?.loaded).toBe(1050);
    });
    test("残り時間を秒と分で表示する", () => {
        expect(duration(0.1)).toBe("1秒");
        expect(duration(61.2)).toBe("1分02秒");
    });
    test("完了件数は増加し、処理完了時の残り時間はゼロになる", async () => {
        let now = 0;
        const updates: { completed: number; total: number; etaSeconds: number | null }[] = [];
        const lane: InferenceLane = {
            name: "wasm", initialBatch: 1, maximumBatch: 2, initialise: async () => undefined, close: () => undefined,
            run: async (texts) => { now += 500; return texts.map(() => Array.from({ length: 384 }, () => 1)); },
        };
        await scheduleInference(["日本語", "物語", "春", "秋"], [lane], new AbortController().signal, () => now, (value) => updates.push(value));
        expect(updates[0]?.etaSeconds).toBeNull();
        expect(updates.some((value) => value.etaSeconds !== null && value.etaSeconds > 0)).toBe(true);
        expect(updates.at(-1)).toEqual({ completed: 4, total: 4, etaSeconds: 0 });
        expect(updates.every((value, index) => value.completed >= (updates[index - 1]?.completed ?? 0))).toBe(true);
    });
});
