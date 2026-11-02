import { duration } from "../src/読取/progress.ts";
import type { ReaderProgress, ProgressPhase } from "../src/読取/types.ts";

const titles: Record<ProgressPhase, string> = {
    receive: "元のページを受信",
    cache: "保存済みの結果を確認", fetch: "ページを取得", observe: "文章と配置を確認", model: "モデルを読込",
    analyse: "文章の意味を解析", layout: "縦書きに組版", save: "結果を保存", display: "ページを表示", complete: "組版完了", error: "処理を中断",
};
export class ProgressView {
    readonly element = document.createElement("section");
    private readonly title = document.createElement("p");
    private readonly track = document.createElement("div");
    private readonly fill = document.createElement("span");
    private readonly detail = document.createElement("p");
    private readonly eta = document.createElement("p");
    private readonly elapsed = document.createElement("p");
    private value: ReaderProgress = { phase: "cache" };
    private began = 0;
    private sampled = 0;
    private timer: ReturnType<typeof setInterval> | undefined;
    constructor() {
        this.element.className = "読書進捗";
        this.title.id = "読書進捗題";
        this.track.className = "読書進捗軌道";
        this.track.setAttribute("role", "progressbar");
        this.track.setAttribute("aria-labelledby", this.title.id);
        this.track.setAttribute("aria-valuemin", "0"); this.track.setAttribute("aria-valuemax", "100");
        this.detail.className = "読書進捗詳細"; this.eta.className = "読書残時間"; this.elapsed.className = "読書経過";
        this.track.append(this.fill); this.element.append(this.title, this.track, this.detail, this.eta, this.elapsed);
        this.update({ phase: "cache" });
    }
    start(): void {
        this.stop(); this.began = performance.now(); this.sampled = this.began;
        this.update({ phase: "cache" });
        this.timer = setInterval(() => this.render(), 1000);
    }
    update(value: ReaderProgress): void {
        const changed = value.phase !== this.value.phase || value.completed !== this.value.completed
            || (value.phase === "model" && value.download?.loaded !== this.value.download?.loaded);
        if (changed) this.sampled = performance.now();
        this.value = value; this.render();
        if (value.phase === "complete" || value.phase === "error") this.stop();
    }
    stop(): void { clearInterval(this.timer); this.timer = undefined; }
    private render(): void {
        const { phase, download, completed, total } = this.value;
        const transferring = phase === "model" && download && download.loaded < download.total;
        const done = transferring ? download.loaded : completed;
        const count = transferring ? download.total : total;
        const fraction = done !== undefined && count && count > 0 ? Math.min(1, Math.max(0, done / count)) : undefined;
        this.element.dataset.phase = phase;
        this.title.textContent = titles[phase];
        this.element.setAttribute("aria-busy", String(phase !== "complete" && phase !== "error"));
        this.track.classList.toggle("読書進捗不定", fraction === undefined && phase !== "complete" && phase !== "error");
        const percent = phase === "complete" ? 100 : fraction === undefined ? undefined : Math.floor(fraction * 100);
        if (percent === undefined) this.track.removeAttribute("aria-valuenow");
        if (percent !== undefined) this.track.setAttribute("aria-valuenow", String(percent));
        this.fill.style.height = String(phase === "error" ? 0 : percent ?? 25) + "%";
        const bytes = (value: number): string => (value / 1048576).toFixed(1) + " MB";
        this.detail.textContent = phase === "analyse" && total ? String(completed ?? 0) + "／" + String(total) + " 領域" : this.value.detail ?? "";
        if (download && download.loaded < download.total) this.detail.textContent += " モデル読込 " + bytes(download.loaded) + "／" + bytes(download.total);
        const estimate = transferring ? download.etaSeconds : this.value.etaSeconds;
        const fresh = performance.now() - this.sampled <= 10000;
        this.eta.textContent = fresh && estimate !== null && estimate !== undefined ? "この工程の残り 約" + duration(estimate) : "残り時間を計算中";
        if (phase === "complete") this.eta.textContent = "完了";
        if (phase === "error") this.eta.textContent = "中断しました";
        this.elapsed.textContent = this.began ? "経過 " + duration((performance.now() - this.began) / 1000) : "";
    }
}
