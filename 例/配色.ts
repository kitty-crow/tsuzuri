type 配色 = "light" | "dark";
const 保存先 = "綴り-配色";
const ボタン = document.querySelector<HTMLButtonElement>("#配色切替");

function 保存された配色(): 配色 | null {
    try {
        const 値 = window.localStorage.getItem(保存先);
        return 値 === "dark" || 値 === "light" ? 値 : null;
    } catch {
        return null;
    }
}

function 配色を保存(値: 配色): void {
    try {
        window.localStorage.setItem(保存先, 値);
    } catch {
        /* 保存できない閲覧環境でも、現在の画面の切替は維持する。 */
    }
}

function 適用(値: 配色): void {
    document.documentElement.dataset.theme = 値;
    document.documentElement.style.colorScheme = 値;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content", 値 === "dark" ? "#131915" : "#f6f4ed",
    );
    if (!ボタン) return;
    ボタン.textContent = 値 === "dark" ? "☀" : "☾";
    ボタン.setAttribute("aria-pressed", String(値 === "dark"));
    ボタン.setAttribute("aria-label", 値 === "dark" ? "明るい配色に切り替える" : "暗い配色に切り替える");
    ボタン.title = ボタン.getAttribute("aria-label") ?? "";
}

const 推奨: 配色 = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
適用(保存された配色() ?? 推奨);
ボタン?.addEventListener("click", () => {
    const 次: 配色 = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    適用(次);
    配色を保存(次);
});
