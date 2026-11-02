import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { MODEL, MODEL_REVISION } from "./types.ts";

env.allowLocalModels = false;
env.useBrowserCache = true;
const wasm = env.backends.onnx.wasm;
if (wasm) { wasm.numThreads = 1; wasm.wasmPaths = new URL("./onnx/", import.meta.url).href; }

let extractor: Promise<FeatureExtractionPipeline> | undefined;
type Request = { id: number; kind: "initialise"; device: "webgpu" | "wasm" } | { id: number; kind: "encode"; texts: string[] };
self.addEventListener("message", (event: MessageEvent<Request>) => {
    void handle(event.data).catch((error: unknown) => self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) }));
});

async function initialise(device: "webgpu" | "wasm"): Promise<void> {
    if (device === "wasm") { extractor = pipeline<"feature-extraction">("feature-extraction", MODEL, { dtype: "q8", device, revision: MODEL_REVISION }); await extractor; return; }
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPUアダプターを利用できません。");
    const dtype = adapter.features.has("shader-f16") ? "fp16" : "fp32";
    extractor = pipeline<"feature-extraction">("feature-extraction", MODEL, { dtype, device, revision: MODEL_REVISION });
    await extractor;
}

async function handle(message: Request): Promise<void> {
    if (message.kind === "initialise") { await initialise(message.device); self.postMessage({ id: message.id, vectors: [] }); return; }
    const run = await extractor;
    if (!run) throw new Error("意味解析が初期化されていません。");
    const output = await run(message.texts, { pooling: "mean", normalize: true });
    const vectors: number[][] = output.tolist();
    self.postMessage({ id: message.id, vectors });
}
