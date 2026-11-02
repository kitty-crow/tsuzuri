import { describe, expect, test } from "bun:test";
import { scheduleInference, type InferenceLane } from "../src/読取/scheduler.ts";

function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function lane(name: string, ms: number, extra: Partial<InferenceLane> = {}): InferenceLane & { batches: number[]; closed: boolean; rows: number } {
    const state = {
        name, initialBatch: 2, maximumBatch: 12, batches: [] as number[], closed: false, rows: 0,
        initialise: async (): Promise<void> => undefined,
        async run(texts: readonly string[]): Promise<number[][]> {
            state.batches.push(texts.length); await delay(ms); state.rows += texts.length;
            return texts.map((text) => Array.from({ length: 384 }, () => Number(text.split(":")[0])));
        },
        close: (): void => { state.closed = true; }, ...extra,
    };
    return state;
}
const texts = Array.from({ length: 48 }, (_, index) => String(index) + ":" + "日本語".repeat(index % 7 + 1));

describe("parallel WebGPU and WASM scheduling", () => {
    test("both lanes run concurrently, steal work and restore source order", async () => {
        const gpu = lane("webgpu", 2);
        const cpu = lane("wasm", 20);
        const vectors = await scheduleInference(texts, [gpu, cpu], new AbortController().signal);
        expect(vectors.map((vector) => vector[0])).toEqual(texts.map((_, index) => index));
        expect(gpu.rows).toBeGreaterThan(0);
        expect(cpu.rows).toBeGreaterThan(0);
        expect(gpu.rows).toBeGreaterThan(cpu.rows);
        expect(gpu.batches.some((size) => size > gpu.initialBatch)).toBe(true);
        expect(gpu.batches.every((size) => size <= gpu.maximumBatch)).toBe(true);
        expect(gpu.closed && cpu.closed).toBe(true);
    });
    test("requeues failed GPU batches while keeping completed CPU results", async () => {
        const gpu = lane("webgpu", 1, { run: async () => { await delay(1); throw new Error("device lost"); } });
        const cpu = lane("wasm", 3);
        const result = await scheduleInference(texts, [gpu, cpu], new AbortController().signal);
        expect(result.map((vector) => vector[0])).toEqual(texts.map((_, index) => index));
        expect(cpu.rows).toBe(texts.length);
        expect(gpu.closed).toBe(true);
    });
    test("returns immediately when CPU work finishes before GPU initialisation", async () => {
        const cpu = lane("wasm", 1);
        const gpu = lane("webgpu", 1, { initialise: () => new Promise(() => undefined) });
        await scheduleInference(texts.slice(0, 2), [gpu, cpu], new AbortController().signal);
        expect(gpu.rows).toBe(0);
        expect(gpu.closed).toBe(true);
    });
    test("retries invalid output on a healthy lane", async () => {
        const bad = lane("webgpu", 1, { run: async () => [[NaN]] });
        const cpu = lane("wasm", 2);
        expect((await scheduleInference(texts, [bad, cpu], new AbortController().signal)).length).toBe(texts.length);
        expect(cpu.rows).toBe(texts.length);
    });
    test("aborts all workers without starting more batches", async () => {
        const controller = new AbortController();
        const cpu = lane("wasm", 30);
        const pending = scheduleInference(texts, [cpu], controller.signal);
        setTimeout(() => controller.abort(), 5);
        await expect(pending).rejects.toThrow();
        expect(cpu.closed).toBe(true);
        expect(cpu.batches.length).toBe(1);
    });
    test("reports total backend failure and accepts empty jobs", async () => {
        const failed = lane("wasm", 1, { initialise: async () => { throw new Error("not supported"); } });
        await expect(scheduleInference(texts, [failed], new AbortController().signal)).rejects.toThrow();
        expect(await scheduleInference([], [], new AbortController().signal)).toEqual([]);
    });
});
