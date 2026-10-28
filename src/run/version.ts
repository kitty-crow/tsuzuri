import type { VersionCfg } from "../types.ts";

export const initVersion = async (base: string, cfg?: VersionCfg): Promise<void> => {
  if (!cfg) return;

  const selector = cfg.selector ?? "[data-version]";
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return;

  const file = cfg.file.replace(/^\/+/, "");
  const urls = versionUrls(base, file, location.origin, document.baseURI);

  for (const url of urls) {
    try {
      const value = await readVersion(url);
      nodes.forEach(node => {
        node.textContent = `${cfg.prefix ?? "v"}${value}`;
      });
      return;
    } catch {
      // Try the next compatible site root.
    }
  }

  nodes.forEach(node => {
    node.textContent = cfg.fallback ?? "v?";
  });
};

export const versionUrls = (
  base: string,
  file: string,
  origin: string,
  documentBase: string
): URL[] => {
  const roots = [
    new URL(base.endsWith("/") ? base : `${base}/`, origin),
    new URL(".", documentBase)
  ];
  const seen = new Set<string>();
  const urls: URL[] = [];

  for (const root of roots) {
    const url = new URL(file, root);
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    urls.push(url);
  }

  return urls;
};

const readVersion = async (url: URL): Promise<string> => {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Version request failed with ${response.status}.`);

  const json: unknown = await response.json();
  if (!isRecord(json)) throw new Error("Version file is invalid.");

  const value = json["version"];
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)) {
    throw new Error("Version file is invalid.");
  }

  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object"
  && value !== null
  && !Array.isArray(value);
