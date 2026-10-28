import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const 対応 = [
    ["furigana", "src/単独/振仮名.ts", ["振仮名"]],
    ["tategaki", "src/単独/縦書.ts", ["縦書", "組版"]],
    ["shoudou", "src/単独/書道.ts", ["書道", "振仮名"]],
    ["kumihan", "src/単独/組版.ts", ["組版"]],
    ["kansuji", "src/単独/漢数字.ts", ["漢数字"]],
    ["koyomi", "src/単独/暦.ts", ["暦", "漢数字"]],
    ["tsuzuri", "src/綴り.ts", ["振仮名", "縦書", "書道", "組版", "漢数字", "暦"]],
] as const;

await mkdir("dist", { recursive: true });
for (const [名前, 入口, 様式名] of 対応) {
    const 結果 = await Bun.build({
        entrypoints: [入口], outdir: "dist", naming: { entry: 名前 + ".js" },
        target: "browser", format: "iife", minify: false,
        sourcemap: "external",
    });
    if (!結果.success) throw new Error("構築に失敗しました: " + 名前);
    const 内容 = await Promise.all(様式名.map((名) => readFile(join("styles", 名 + ".css"), "utf8")));
    await writeFile(join("dist", 名前 + ".css"), 内容.join("\n\n"), "utf8");
}
await mkdir("site/dist", { recursive: true });
for (const [名前] of 対応) {
    await copyFile(join("dist", 名前 + ".js"), join("site/dist", 名前 + ".js"));
    await copyFile(join("dist", 名前 + ".css"), join("site/dist", 名前 + ".css"));
}
console.log("配布ファイルの構築が完了しました。");

