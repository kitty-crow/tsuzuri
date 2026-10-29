# 綴り

**綴り（つづり）**は、縦書き・横書き、振仮名、合成漢字、日本語組版、漢数字、和暦に対応した、フレームワーク非依存のブラウザー向け日本語組版ライブラリーです。HTML の専用要素で利用でき、JavaScript の初期化コードは不要です。

**安定版：v1.0.0** ・ **ライセンス：MIT** ・ [要素と属性](文書/書式.md) ・ [設計](文書/設計.md) ・ [変更履歴](CHANGELOG.md)

## 1. インストール・導入方法

配布物はブラウザーで直接動作する JavaScript（IIFE）と CSS の組です。**npm パッケージとしては公開していません。** 次のいずれかの方法で導入してください。

### CDN 形式：HTML から直接読み込む

ファイルのダウンロードやビルドは不要です。全機能を利用する場合：

~~~html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <script src="https://app.kittycrow.dev/tsuzuri/dist/tsuzuri.js" defer></script>
</head>
<body>
  <tsuzuri>
     <t-漢字 横 振り="つづり">綴り</t-漢字>で日本語を組む。
  </tsuzuri>
</body>
</html>
~~~

必要な機能だけを読み込む場合は、たとえば振仮名専用の `furigana.js` に変更します。

~~~html
<script src="https://app.kittycrow.dev/tsuzuri/dist/furigana.js" defer></script>
~~~

これは `app.kittycrow.dev` のリバースプロキシ経由で提供するビルド済み配布物の URL です。各 JavaScript は**同じディレクトリーにある同名の CSS を自動的に読み込む**ため、通常は別途 `<link>` を追加する必要はありません。

**注意：** 上記 URL は公開中の最新版を指し、特定の版に固定されません。バージョンを固定したい本番サイトでは、次の方法で JS と CSS を手元に保存し、自分のサーバーから配信してください。`dist/` は Git にコミットしていないため、`cdn.jsdelivr.net/gh/.../dist/` のパスでは配布できません。

### ビルド済みファイルを curl でダウンロードする

ダウンロードにはリバースプロキシを使わず、GitHub Pages の配布元から直接取得します。

全機能を使う `tsuzuri.js` と `tsuzuri.css` をダウンロードします。

~~~sh
mkdir -p public/vendor/tsuzuri
curl -fL --retry 3 \
  -o public/vendor/tsuzuri/tsuzuri.js \
  https://kitty-crow.github.io/tsuzuri/dist/tsuzuri.js
curl -fL --retry 3 \
  -o public/vendor/tsuzuri/tsuzuri.css \
  https://kitty-crow.github.io/tsuzuri/dist/tsuzuri.css
~~~

全機能版と各単独版を一括取得したい場合：

~~~sh
mkdir -p public/vendor/tsuzuri
for name in tsuzuri furigana tategaki shoudou kumihan kansuji koyomi; do
  for ext in js css; do
    curl -fL --retry 3 \
      -o "public/vendor/tsuzuri/$name.$ext" \
      "https://kitty-crow.github.io/tsuzuri/dist/$name.$ext" || exit 1
  done
done
~~~

ダウンロードした JS と CSS を同じ場所に置き、サイトの HTML から読み込みます。

~~~html
<script src="/vendor/tsuzuri/tsuzuri.js" defer></script>
~~~

`public/` は静的サイトの配置例です。使用するウェブサーバーに合わせて変更してください。

## 2. ライブラリーのソースコードだけをダウンロードする

Git の sparse checkout を使えば、ライブラリー本体・CSS の原稿・ビルド道具だけを取得できます。

~~~sh
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/kitty-crow/tsuzuri.git tsuzuri-src
cd tsuzuri-src
git sparse-checkout set src styles 道具
~~~

取得するディレクトリーは `src/`（TypeScript の実装）、`styles/`（CSS の原稿）、`道具/`（ビルドスクリプト）です。ルートの `package.json`、`tsconfig.json` などの必要なファイルも取得されます。リポジトリーの他のディレクトリーはチェックアウトされません。

## 3. ソースからビルドする

[Bun](https://bun.sh/) をインストールした状態で、上記のソース取得ディレクトリー内から実行します。

~~~sh
bun install
bun run build:lib
~~~

結果は `dist/` に生成されます。**ライブラリーだけを構築するコマンド**であり、ウェブサイトの生成は行いません。出力された `.js` と `.css` を同じディレクトリーに配置して使用してください。

## 4. 配布ファイルと機能

全機能の統合版 `tsuzuri.js`、または必要な機能だけを含む単独版を選べます。

| JavaScript | 自動読込 CSS | 対応する機能 |
|---|---|---|
| `tsuzuri.js` | `tsuzuri.css` | 全機能 |
| `furigana.js` | `furigana.css` | 振仮名 |
| `tategaki.js` | `tategaki.css` | 縦書き・横書き、組版 |
| `shoudou.js` | `shoudou.css` | 合成漢字 |
| `kumihan.js` | `kumihan.css` | 日本語組版 |
| `kansuji.js` | `kansuji.css` | 漢数字 |
| `koyomi.js` | `koyomi.css` | 和暦と対応済みの旧暦 |

統合版と単独版を重複して読み込む必要はありません。全ての配布版はブラウザー向けで、外部の JavaScript フレームワークを必要としません。

## 5. HTML ページで使う

`<tsuzuri>` または `<t-綴>` で囲んだ内容を綴りが処理します。縦書きが既定ですが、これは処理領域の指定であり、縦書き専用の要素ではありません。通常の HTML と組み合わせて利用できます。

### 日本語の記法

~~~html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <script src="./vendor/tsuzuri/tsuzuri.js" defer></script>
</head>
<body>
  <t-綴>
    <t-振り 読み="ことば">言葉</t-振り>を
    <t-漢字 横 振り="つづり">綴り</t-漢字>ます。

    <t-横>ここだけ横書きです。</t-横>
    <t-縦>ここは明示的な縦書きです。</t-縦>

    <t-漢数字 値="2026"></t-漢数字>
    <t-暦 日付="2026-10-28"></t-暦>
  </t-綴>
</body>
</html>
~~~

### ローマ字の記法

~~~html
<tsuzuri>
  <furigana reading="ことば">言葉</furigana>を
  <kanji horizontal reading="つづり">綴り</kanji>ます。

  <yokogaki>ここだけ横書きです。</yokogaki>
  <tategaki>ここは明示的な縦書きです。</tategaki>

  <kansuji value="2026"></kansuji>
  <koyomi date="2026-10-28"></koyomi>
</tsuzuri>
~~~

日本語とローマ字の要素を同じ処理領域内で混在させても、結果は変わりません。初期化処理は不要で、後から追加した要素も自動で処理します。

### 処理領域と書字方向

| 日本語 | ローマ字 | 働き |
|---|---|---|
| `<t-綴>` | `<tsuzuri>` | 内容を既定の設定で処理 |
| `<t-綴 縦>` | `<tsuzuri vertical>` | 縦書きを明示 |
| `<t-綴 横>` | `<tsuzuri horizontal>` | 横書きを明示 |
| `<t-縦>` | `<tategaki>` | 内側だけ縦書き |
| `<t-横>` | `<yokogaki>` | 内側だけ横書き |

~~~html
<t-綴 横>
  横書きの文章です。
  <t-縦>この部分だけ縦書きになります。</t-縦>
  ここから横書きに戻ります。
</t-綴>
~~~

### 振仮名と合成漢字

`<kanji>` と `<t-漢字>` は、合成方向や表意文字記述を指定しなければ文字を合成しません。読みだけを付けた場合は `<furigana>` や `<t-振り>` と同じ振仮名になります。

~~~html
<t-綴>
  <t-振り 読み="にほんご">日本語</t-振り>
  <t-漢字 振り="ことば">言葉</t-漢字>
  <t-漢字 横 振り="つづり">綴り</t-漢字>
  <t-漢字 縦 振り="にほん">日本</t-漢字>
</t-綴>
~~~

~~~html
<tsuzuri>
  <furigana reading="にほんご">日本語</furigana>
  <kanji reading="ことば">言葉</kanji>
  <kanji horizontal reading="つづり">綴り</kanji>
  <kanji vertical reading="にほん">日本</kanji>
</tsuzuri>
~~~

### 入れ子になった合成漢字

各合成要素は二つの部品を組み合わせます。部品には、さらに合成要素を指定できます。改行と字下げの空白は部品に含みません。

~~~html
<t-綴>
  <t-漢字 縦>
    <t-漢字 横>日本</t-漢字>
    <t-漢字 横>綴り</t-漢字>
  </t-漢字>
</t-綴>
~~~

~~~html
<tsuzuri>
  <kanji vertical>
    <kanji horizontal>日本</kanji>
    <kanji horizontal>綴り</kanji>
  </kanji>
</tsuzuri>
~~~

どちらも `⿱⿰日本⿰綴り` と同じ構造です。表意文字記述を直接書くこともできます。

~~~html
<tsuzuri>
  <kanji>⿱⿰日本⿰綴り</kanji>
</tsuzuri>
~~~

要素・属性の詳しい対応表、漢数字、暦の指定方法については [要素と属性](文書/書式.md) を参照してください。

## 6. 対応範囲と制限

- 合成漢字は `⿰`（左右）と `⿱`（上下）およびその入れ子に対応します。元の表意文字記述は選択・複写可能です。文字の見た目はブラウザーや書体によって多少異なる場合があります。
- `calendar="kyureki"` は照合済みの期間のみ対応します。未確認の日付について推測した旧暦を表示することはありません。通常の和暦表記は `calendar` を省略します。
- 全面的な天文暦変換、特殊な表意文字記述演算子、独自の完全な禁則処理は今後の拡張領域です。

## ライセンス

[MIT](LICENSE)
