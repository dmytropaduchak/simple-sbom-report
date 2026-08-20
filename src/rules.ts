export type Component = {
  name: string;
  version: string;
  purl: string;
};

export type SbomDoc = {
  bomFormat: "CycloneDX";
  specVersion: string;
  version: number;
  metadata: { timestamp: string; tools: Array<{ name: string; version: string }> };
  components: Array<{
    type: string;
    name: string;
    version: string;
    purl: string;
  }>;
};

export function componentsFromPackageLock(text: string): Component[] {
  const data = JSON.parse(text) as {
    packages?: Record<string, { version?: string; name?: string }>;
    dependencies?: Record<string, { version?: string }>;
  };
  const out: Component[] = [];
  if (data.packages) {
    for (const [key, meta] of Object.entries(data.packages)) {
      if (!key || key === "") continue;
      const name = meta.name || key.replace(/^node_modules\//, "").replace(/\/node_modules\//g, "/");
      const version = meta.version || "";
      if (!version) continue;
      out.push({ name, version, purl: `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${version}` });
    }
    return dedupe(out);
  }
  for (const [name, meta] of Object.entries(data.dependencies || {})) {
    const version = (meta.version || "").replace(/^[^\d]*/, "") || meta.version || "";
    if (!version) continue;
    out.push({ name, version, purl: `pkg:npm/${name}@${version}` });
  }
  return dedupe(out);
}

export function componentsFromYarnLock(text: string): Component[] {
  const out: Component[] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const header = block.match(/^"?(@?[^@\s"]+)@[^:]+:/);
    const version = block.match(/^\s+version\s+"([^"]+)"/m);
    if (!header || !version) continue;
    const name = header[1];
    out.push({
      name,
      version: version[1],
      purl: `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${version[1]}`,
    });
  }
  return dedupe(out);
}

export function componentsFromPnpmLock(text: string): Component[] {
  const out: Component[] = [];
  const packagesIdx = text.indexOf("\npackages:");
  const section = packagesIdx >= 0 ? text.slice(packagesIdx) : text;
  const re = /^\s{2}('?@?[^'@\s]+(?:\/[^'@\s]+)?)@([^':]+)'?:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    const name = m[1].replace(/^'/, "");
    const version = m[2];
    out.push({
      name,
      version,
      purl: `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${version}`,
    });
  }
  return dedupe(out);
}

function dedupe(items: Component[]): Component[] {
  const map = new Map<string, Component>();
  for (const c of items) map.set(`${c.name}@${c.version}`, c);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCycloneDx(components: Component[], toolVersion = "0.1.0"): SbomDoc {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ name: "simple-sbom-report", version: toolVersion }],
    },
    components: components.map((c) => ({
      type: "library",
      name: c.name,
      version: c.version,
      purl: c.purl,
    })),
  };
}

export function formatSbomSummary(components: Component[], outputPath: string, marker: string, name: string): string {
  const sample = components
    .slice(0, 20)
    .map((c) => `| \`${c.name}\` | ${c.version} |`)
    .join("\n");
  return [
    marker,
    `## ${name}`,
    "",
    `Wrote **${components.length}** component(s) to \`${outputPath}\` (CycloneDX).`,
    "",
    "### Sample",
    "",
    "| Package | Version |",
    "| --- | --- |",
    sample || "| — | — |",
  ].join("\n");
}
