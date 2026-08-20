# simple-sbom-report

Emits a CycloneDX JSON SBOM from `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. No CVE or license severity findings.

## Usage

```yaml
- uses: actions/checkout@v4
- uses: dmytropaduchak/simple-sbom-report@v0.1.0
  with:
    output-path: sbom.cdx.json
- uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.cdx.json
```

## Develop

```bash
npm install && npm run build
```
