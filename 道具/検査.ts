import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const 対象 = ["src", "道具", "試験", "例"] as const;
const 違反: string[] = [];

async function 一覧(場所: string): Promise<string[]> {
    const 内容 = await readdir(場所, { withFileTypes: true });
    const 子 = await Promise.all(内容.map(async (項目) => {
        const 名前 = join(場所, 項目.name);
        return 項目.isDirectory() ? 一覧(名前) : [名前];
    }));
    return 子.flat();
}

function 点検(名前: string, 内容: string): void {
    const 文書 = ts.createSourceFile(名前, 内容, ts.ScriptTarget.Latest, true, 名前.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const 見る = (節: ts.Node, 深さ: number): void => {
        const 条件 = ts.isIfStatement(節) || ts.isSwitchStatement(節);
        const 位置 = 文書.getLineAndCharacterOfPosition(節.getStart(文書));
        const 接頭 = 名前 + ":" + String(位置.line + 1) + " ";
        if (条件 && 深さ > 0) 違反.push(接頭 + "条件分岐の入れ子");
        if (節.kind === ts.SyntaxKind.AnyKeyword) 違反.push(接頭 + "曖昧な型");
        ts.forEachChild(節, (子) => 見る(子, 深さ + Number(条件)));
    };
    見る(文書, 0);
    if (/[@]ts-(?:ignore|nocheck)|eslint-disable/.test(内容)) 違反.push(名前 + " 型検査の無効化");
    if (/\bas\s+unknown\s+as\b/.test(内容)) 違反.push(名前 + " 二重の型変換");
}

for (const 場所 of 対象) {
    for (const 名前 of await 一覧(場所)) {
        if (/\.(?:js|jsx|mjs|cjs)$/.test(名前)) 違反.push(名前 + " JavaScriptの原稿");
        if (!/\.tsx?$/.test(名前) || 名前.endsWith(".d.ts")) continue;
        点検(名前, await readFile(名前, "utf8"));
    }
}
if (違反.length > 0) throw new Error(違反.join("\n"));
console.log("型と条件分岐の規則に違反はありません。");

