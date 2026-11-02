import { cp, copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const target = "extension-dist";
await mkdir(target, { recursive: true });
await mkdir(join(target, "LICENSES"), { recursive: true });
const manifest = {
    manifest_version: 3, name: "綴りで読む", version: "0.1.0", minimum_chrome_version: "120",
    description: "開いている日本語のページを、綴りで縦書きに。文章と配置の解析はブラウザー内で行います。",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["https://huggingface.co/*", "https://*.huggingface.co/*", "https://*.hf.co/*"],
    action: { default_title: "このページを綴りで読む" },
    background: { service_worker: "background.js" },
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co; style-src 'self' 'unsafe-inline' https: http:; img-src 'self' https: http: data:; font-src 'self' https: http: data:;" },
};
const build = await Bun.build({ entrypoints: ["src/拡張/background.ts", "src/拡張/capture.ts"], outdir: target, naming: { entry: "[name].js" }, target: "browser", format: "iife", minify: true });
if (!build.success) throw new Error(build.logs.join("\n"));
await Promise.all([
    writeFile(join(target, "manifest.json"), JSON.stringify(manifest, null, 2)),
    writeFile(join(target, "index.html"), '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>綴りで読む</title><link rel="stylesheet" href="様式.css"><link rel="stylesheet" href="読書.css"><script src="dist/tsuzuri.js" defer></script><script src="配色.js" defer></script><script src="読書.js" defer></script></head><body></body></html>'),
    ...["様式.css", "読書.css", "読書.js", "reader-model.js", "配色.js"].map((file) => copyFile(join("site", file), join(target, file))),
    cp("site/onnx", join(target, "onnx"), { recursive: true }), cp("site/dist", join(target, "dist"), { recursive: true }),
    copyFile("LICENSE", join(target, "LICENSE")), copyFile("文書/拡張機能.md", join(target, "README.md")),
    ...["@huggingface/transformers", "@huggingface/jinja", "dompurify"].map((name) => copyFile(join("node_modules", name, "LICENSE"), join(target, "LICENSES", name.replaceAll("/", "-") + ".txt"))),
    ...["ONNX-Runtime-LICENSE.txt", "ONNX-Runtime-ThirdPartyNotices.txt"].map((name) => copyFile(join("文書", name), join(target, "LICENSES", name))),
]);
console.log("Brave / Chrome 拡張機能を構築しました。");
