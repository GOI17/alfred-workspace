# Alfred workspace

개발 및 유지 관리: **[Alfredlabs](https://alfredlabs.org)**.

코딩 에이전트, 터미널, Git worktree 및 폴더를 로컬과 원격 환경에서 함께 사용하는 작업 공간입니다.

[GOI17/alfred-workspace](https://github.com/GOI17/alfred-workspace)

## 개발

Node.js 24+와 pnpm이 필요합니다. 명령은 `alfred`이며 설정에는 `ALFRED_*`를 사용합니다. 독립된 설치이므로 기존 데이터와 자격 증명은 자동으로 이전되지 않습니다.

```sh
pnpm install
pnpm dev
```

[AGENTS.md](../../AGENTS.md) · [Style guide](../STYLEGUIDE.md)

## 배포

개발 빌드는 저장소 아티팩트로 제공됩니다. 호스팅 서비스, 앱 스토어 및 서명된 릴리스에는 별도 설정이 필요합니다.

[Alfred workspace](../../README.md) · [Migration](../alfredlabs-fork.md)

## 라이선스 및 출처

[MIT](../../LICENSE) · [NOTICE](../../NOTICE.md)
