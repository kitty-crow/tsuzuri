import { relative, resolve, sep } from "node:path";
import { chromium, type Page } from "playwright";
import { mobileViewport } from "./mobile.ts";

const phoneViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
] as const;

interface LayoutResult {
  readonly viewport: number;
  readonly documentWidth: number;
  readonly meta: string | null;
  readonly rootMasks: readonly string[];
  readonly rootCanScroll: boolean;
  readonly offenders: readonly string[];
  readonly fixedOffenders: readonly string[];
}

export const auditMobile = async (directory: string): Promise<void> => {
  const root = resolve(directory);
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.html");
  for await (const file of glob.scan({ cwd: root, onlyFiles: true })) files.push(file.replaceAll("\\", "/"));
  files.sort();
  if (files.length === 0) throw new Error(`No HTML pages found in ${root}.`);

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname);
      const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      const target = resolve(root, `.${requested}`);
      const rel = relative(root, target);
      if (rel.startsWith("..") || rel === ".." || rel.startsWith(`..${sep}`)) return new Response("Not found", { status: 404 });

      const direct = Bun.file(target);
      if (await direct.exists()) return new Response(direct);

      const nested = Bun.file(resolve(target, "index.html"));
      if (await nested.exists()) return new Response(nested);

      const notFound = Bun.file(resolve(root, "404.html"));
      if (await notFound.exists()) return new Response(notFound, { status: 404 });
      return new Response("Not found", { status: 404 });
    }
  });

  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];

  try {
    for (const file of files) {
      const route = routeFor(file);
      for (const viewport of phoneViewports) {
        const context = await browser.newContext({
          viewport,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2
        });
        const page = await context.newPage();
        const url = `http://127.0.0.1:${server.port}${route}`;

        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await settle(page);
          failures.push(...messages(file, `${viewport.width}x${viewport.height} portrait`, await inspect(page)));

          await page.setViewportSize({ width: viewport.height, height: viewport.width });
          await settle(page);
          failures.push(...messages(file, `${viewport.height}x${viewport.width} landscape`, await inspect(page)));

          await page.setViewportSize(viewport);
          await settle(page);
          failures.push(...messages(file, `${viewport.width}x${viewport.height} portrait-after-rotation`, await inspect(page)));
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.stop(true);
  }

  if (failures.length > 0) {
    throw new Error(`Mobile responsiveness audit failed:\n${failures.map(item => `- ${item}`).join("\n")}`);
  }
};

const routeFor = (file: string): string => {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file}`;
};

const settle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await new Promise<void>(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
  });
  await page.waitForTimeout(150);
};

const inspect = async (page: Page): Promise<LayoutResult> => await page.evaluate(() => {
  const html = document.documentElement;
  const body = document.body;
  const viewport = window.innerWidth;
  const tolerance = 1;
  const documentWidth = Math.max(html.scrollWidth, body?.scrollWidth ?? 0);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? null;

  const rootMasks: string[] = [];
  for (const [name, element] of [["html", html], ["body", body]] as const) {
    if (!element) continue;
    const overflow = getComputedStyle(element).overflowX;
    if (overflow === "hidden" || overflow === "clip") rootMasks.push(`${name}: overflow-x=${overflow}`);
  }

  const visible = (element: Element): boolean => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
  };

  const locallyContained = (element: Element): boolean => {
    for (let parent = element.parentElement; parent && parent !== body && parent !== html; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowX;
      if (overflow === "auto" || overflow === "scroll" || overflow === "hidden" || overflow === "clip") return true;
    }
    return false;
  };

  const describe = (element: Element): string => {
    const node = element as HTMLElement;
    const id = node.id ? `#${node.id}` : "";
    const classes = typeof node.className === "string" && node.className.trim()
      ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    const rect = element.getBoundingClientRect();
    return `${element.tagName.toLowerCase()}${id}${classes} [${rect.left.toFixed(1)}, ${rect.right.toFixed(1)}]`;
  };

  const elements = Array.from(document.querySelectorAll("*"));
  const offenders = elements
    .filter(visible)
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return (rect.left < -tolerance || rect.right > viewport + tolerance) && !locallyContained(element);
    })
    .slice(0, 12)
    .map(describe);

  const fixedOffenders = elements
    .filter(visible)
    .filter(element => getComputedStyle(element).position === "fixed")
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -tolerance || rect.right > viewport + tolerance;
    })
    .slice(0, 12)
    .map(describe);

  const y = window.scrollY;
  window.scrollTo(1_000_000, y);
  const rootCanScroll = Math.abs(window.scrollX) > tolerance;
  window.scrollTo(0, y);

  return { viewport, documentWidth, meta, rootMasks, rootCanScroll, offenders, fixedOffenders };
});

const messages = (file: string, phase: string, result: LayoutResult): readonly string[] => {
  const out: string[] = [];
  const prefix = `${file} @ ${phase}`;

  if (result.meta !== mobileViewport) out.push(`${prefix}: viewport meta is ${JSON.stringify(result.meta)}; expected ${JSON.stringify(mobileViewport)}`);
  if (result.rootMasks.length > 0) out.push(`${prefix}: root overflow is being masked (${result.rootMasks.join(", ")})`);
  if (result.documentWidth > result.viewport + 1 || result.rootCanScroll) {
    const detail = result.offenders.length > 0 ? ` Likely offenders: ${result.offenders.join("; ")}` : "";
    out.push(`${prefix}: document is ${result.documentWidth}px wide for a ${result.viewport}px viewport.${detail}`);
  }
  if (result.fixedOffenders.length > 0) out.push(`${prefix}: fixed elements escape the viewport: ${result.fixedOffenders.join("; ")}`);
  return out;
};
