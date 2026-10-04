# App Store Metadata Lint

App Storeのローカライズ原稿を、配信前にローカルやCIで確認する小さなCLIです。
文字数とUTF-8容量、重複語、区切り文字、空白を検査します。
日本語を含むUnicode文字を保持し、必須制約はerror、推奨ルールはwarningで返します。

[English](README.md) · [検査ルールと公式出典](docs/rules.md)

Node.js 24.19以上の24系を使用します。実行時依存はなく、ビルドやログインも不要です。
ネットワークアクセス、計測送信、App Store Connectの更新は行いません。

## 実行

ソースを取得してディレクトリへ移動します。

```sh
git clone https://github.com/mekkoo/app-store-metadata-lint.git
cd app-store-metadata-lint
```

```sh
mise exec -- npm run demo
mise exec -- npm run lint -- examples/valid --strict --json
mise exec -- npm run lint -- /path/to/metadata.json
```

miseなしでもNode.js 24から直接実行できます。

```sh
node src/cli.ts store/ios --strict --json
```

ディレクトリ指定時は`metadata.json`と`*.metadata.json`を再帰的に検査します。
隠しパス、node_modules、シンボリックリンクは除外します。
ファイルを直接指定すれば任意の名前を使えます。複数パスも指定できます。
1ファイル1 MiB、ディレクトリ深さ20階層までです。

## 原稿

```json
{
  "locale": "ja-JP",
  "name": "まるごと献立",
  "subtitle": "今日の夕食と買い物を手軽に",
  "keywords": "レシピ,節約,作り置き,冷蔵庫,時短,料理",
  "primaryCategory": "フード／ドリンク"
}
```

nameとkeywordsは必須です。subtitle、locale、companyName、primaryCategory、
secondaryCategoryは任意の文字列です。その他の項目は検査対象にしません。
サンプル原稿は架空のもので、実アプリの非公開原稿を含みません。

## 判定

- 名前2〜30文字、サブタイトル30文字以内、キーワードの容量上限を確認します。
- キーワードは既定で100 UTF-8 bytes。`--keyword-limit characters`で100文字に切り替えます。
- Apple公式にはbytesとcharactersの両表記があるため、両方の計測値を表示します。
- 重複、区切り、空白、英語の単複はwarningです。語句の中の空白は許可します。
- 通常はerrorで終了コード1。`--strict`ではwarningも1。不正な入力やオプションは2です。
- `--json`はエラー時も構造化レポートを返します。

日本語の重複は完全一致のUnicodeトークンで判定します。日本語の形態素解析や
部分文字列による一致は行いません。たとえば「献立 ノート」とkeywordsの「献立」は
検出できますが、「毎日の献立」から「献立」を自動抽出しません。
NFKC正規化と大文字小文字の統一は比較時だけ使い、容量は元の入力で計測します。

検索需要や順位改善、審査通過を予測するツールではありません。
詳しい限界と一次情報は[ルール資料](docs/rules.md)にまとめています。

## 開発・公開状態

```sh
mise exec -- npm ci --ignore-scripts
mise exec -- npm run check
mise exec -- npm run demo
mise exec -- npm run pack:check
```

[mekkoo個人の公開リポジトリ](https://github.com/mekkoo/app-store-metadata-lint)で
MITライセンスのソースを提供しています。npmパッケージは公開していません。
誤ったnpm公開を防ぐためpackage.jsonはprivateにしています。
npmでの名称の利用可否は未確認です。

不具合報告はGitHubのIssues、改善案はPull Requestで受け付けます。
[開発・貢献手順](CONTRIBUTING.md)に沿って、Linux・macOSのCIで
型検査、テスト、サンプル原稿、配布内容、公開対象の秘匿情報検査を実行します。
