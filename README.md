# simple-sbom-report

Emits a CycloneDX JSON SBOM from `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. No CVE or license severity findings.

## Usage

```yaml
name: SBOM report
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  simple-sbom-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmytropaduchak/simple-sbom-report@v0.1.1
        with:
          output-path: sbom.cdx.json
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.cdx.json
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Token to post sticky PR comments |
| `lockfile-path` | _(auto)_ | Lockfile path |
| `output-path` | `sbom.cdx.json` | CycloneDX JSON output path |

## Develop

```bash
npm install && npm run build
```
