import { 開始 } from "./中核.ts";
import { 書道を描く } from "./書道.ts";
import { 振仮名を描く } from "./振仮名.ts";
import { 漢数字を描く } from "./漢数字.ts";
import { 暦を描く } from "./暦.ts";
import { 組版を描く } from "./組版.ts";
import { 縦書を描く } from "./縦書.ts";

/** 一つの読み込みで全機能を利用する。 */
開始("tsuzuri", [書道を描く, 振仮名を描く, 漢数字を描く, 暦を描く, 組版を描く, 縦書を描く]);

