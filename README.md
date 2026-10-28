# 綴り

**綴り**は、日本語の書字表現を扱う、フレームワーク非依存の描画ライブラリーです。縦書き、振仮名、合成漢字、組版、漢数字、暦の機能を、意味の分かる要素だけで使えます。

## 最小構成

```html
<script src="dist/tsuzuri.js"></script>
<tsuzuri>
  <jp-furigana reading="つづり">綴り</jp-furigana>
  <jp-kanji reading="にほん">⿱日本</jp-kanji>
</tsuzuri>
```

追加の初期化処理や設定は不要です。配布物は構築時に依存物をまとめた独立したファイルです。各配布ファイルは同じ場所にある対応する様式ファイルを自動読込します。

## 原稿と配布物

| 原稿 | 配布ファイル | 役割 |
|---|---|---|
| `src/振仮名.ts` | `furigana.js` | 振仮名の略記 |
| `src/縦書.ts` | `tategaki.js` | 縦書きと横書き |
| `src/書道.ts` | `shoudou.js` | 合成文字と読み |
| `src/組版.ts` | `kumihan.js` | 日本語組版 |
| `src/漢数字.ts` | `kansuji.js` | 漢数字 |
| `src/暦.ts` | `koyomi.js` | 和暦と限定的な旧暦 |
| `src/綴り.ts` | `tsuzuri.js` | 全機能の統合 |

`styles/` に機能別の原稿を置きます。構築時に配布用の対応した様式ファイルも生成します。

## 要素の使い方

```html
<tsuzuri>春はあけぼの。</tsuzuri>
<tsuzuri direction="horizontal">横書きです。</tsuzuri>
<jp-tategaki>縦書きです。</jp-tategaki>
<jp-yokogaki>横書きです。</jp-yokogaki>
<jp-furigana reading="ことば">言葉</jp-furigana>
<jp-kanji reading="にほんご">⿱⿰日本語</jp-kanji>
<jp-kansuji value="2026" style="digits"></jp-kansuji>
<jp-kansuji value="18" style="daiji"></jp-kansuji>
<jp-koyomi date="2026-10-28" calendar="kyureki"></jp-koyomi>
```

合成漢字は `⿰`（左右）と `⿱`（上下）に対応し、入れ子にできます。構文や異体字そのものを複写できることを重視しています。

### 暦について

`calendar="kyureki"` は**照合済みの暦月**だけを扱います。文化年間の一部の寛政暦と、2026年秋の一部を収録しています。未対応の日付を推測して表示することはありません。通常の和暦表記は `calendar` を省略します。旧暦の正確な一般変換は今後の課題です。

## 構築・検査

```sh
bun install
bun run check
bun run build
bun 試験/画面.ts
```

厳密な型検査、曖昧な型の禁止、条件分岐の入れ子禁止、型検査無効化の禁止を継続的に確認します。紹介ページの構築には `vendor/website` に固定したウェブサイト用補助コードを使用しますが、配布ライブラリーには含めません。紹介ページ以外でこの補助コードを読み込むことはありません。

## 掲載例

紹介ページは `例/構築.tsx` から生成します。末尾には `例/白萩の露.md` の本篇と後日譚を一つの縦書きの巻物として掲載します。`#`、`##`、`###` の見出しも含め、一つの Markdown 原稿全体を `marked` で解釈し、振仮名・合成漢字・旧暦の表示は綴りに委ねます。`marked` は配布ライブラリーへ含めません。短い行も必ず上から組み始めます。紹介ページの明暗はボタンで切り替えられ、選択した配色をブラウザーに保存します。`dist/` と `site/` は構築時の生成物です。公開用の構築処理が `site/` を配信します。

## ライセンス

MIT


紹介ページの配色切替コードは `例/配色.ts` から生成されます。配布ライブラリーの一部ではありません。祝言の「弥生吉日」については日付が特定されていないため、文化十二年弥生六日に相当する `1815-04-15` を代表日として記述しています。
