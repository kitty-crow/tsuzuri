/** Serializable compiler IR. IDs refer to sanitised source nodes, never selectors. */
export const ENGINE = "reader-1.1.0";
export const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const MODEL_REVISION = "2c4055b12046f11709e9df2c122e59ffbdc2f900";
export const EMBEDDING_POLICY = "hybrid-q8-fp16-fp32-v1";
export const ROLES = ["prose", "heading", "navigation", "caption", "interface", "code", "data"] as const;
export type Role = typeof ROLES[number];
export type Scores = Record<Role, number>;
export type Token = Readonly<{
    start: number; end: number; text: string;
    kind: "japanese" | "latin" | "number" | "punctuation" | "space" | "other";
    word: boolean;
}>;
export type Region = Readonly<{
    id: number; parent: number | null; tag: string; role: string; lang: string;
    text: string; tokens: readonly Token[]; japanese: number; links: number;
    protected: boolean; heading: number; x: number; y: number; width: number; height: number;
    fontSize: number; fontFamily: string; fontWeight: string; colour: string; background: string;
    display: string; writingMode: string; position: string;
}>;
export type Edge = Readonly<{ from: number; to: number; kind: "contains" | "sequence" | "alignment" | "label" | "nearby"; weight: number }>;
export type PageGraph = Readonly<{ regions: readonly Region[]; edges: readonly Edge[]; width: number; height: number }>;
export type Inference = Readonly<{ id: number; scores: Scores; role: Role; confidence: number }>;
export type Plan = Readonly<{ id: number; mode: "vertical" | "horizontal"; confidence: number; role: Role }>;
export type SemanticResult = Readonly<{ vectors: readonly (readonly number[])[]; model: string }>;
export type SavedPage = Readonly<{
    key: string; engine: string; url: string; baseURL: string; title: string; source: string; hash: string;
    html: string; graph: PageGraph; plans: readonly Plan[]; model: string;
    created: number; accessed: number; bytes: number;
}>;
export interface PageStore {
    get(key: string): Promise<SavedPage | undefined>;
    put(page: SavedPage): Promise<void>;
    delete(key: string): Promise<void>;
}
export interface SemanticEncoder {
    encode(texts: readonly string[], signal: AbortSignal, progress?: ProgressSink): Promise<SemanticResult>;
}
export type ProgressPhase = "receive" | "cache" | "fetch" | "observe" | "model" | "analyse" | "layout" | "save" | "display" | "complete" | "error";
export type TransferProgress = Readonly<{ loaded: number; total: number; etaSeconds: number | null }>;
export type ReaderProgress = Readonly<{
    phase: ProgressPhase; completed?: number; total?: number; etaSeconds?: number | null;
    download?: TransferProgress; detail?: string;
}>;
export type ProgressSink = (progress: ReaderProgress) => void;
export type ModelFileProgress = Readonly<{ file: string; status: string; loaded: number; total: number }>;
