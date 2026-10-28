import { 包む, 置換 } from "./中核.ts";

/** 禁則処理などはブラウザーの組版機能を優先する。 */
export function 組版を描く(根: ParentNode): void {
    置換(根, "jp-kumihan", (元) => 包む(元, "綴り-組版"));
}

