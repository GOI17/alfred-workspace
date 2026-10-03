# Alfred workspace

開発・保守： **[Alfredlabs](https://alfredlabs.org)**.

コーディングエージェント、ターミナル、Git worktree、フォルダーをローカルでもリモートでも扱えるワークスペースです。

[GOI17/alfred-workspace](https://github.com/GOI17/alfred-workspace)

## 開発

Node.js 24+ と pnpm が必要です。コマンドは `alfred`、設定には `ALFRED_*` を使用します。独立したインストールのため、既存のデータや認証情報は自動移行されません。

```sh
pnpm install
pnpm dev
```

[AGENTS.md](../../AGENTS.md) · [Style guide](../STYLEGUIDE.md)

## 配布

開発ビルドはリポジトリのアーティファクトとして提供されます。ホスト型サービス、ストア配布、署名付きリリースには個別の設定が必要です。

[Alfred workspace](../../README.md) · [Migration](../alfredlabs-fork.md)

## ライセンスと帰属

[MIT](../../LICENSE) · [NOTICE](../../NOTICE.md)
