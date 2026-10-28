export const mobileViewport = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

export const mobileViewportTag = `<meta name="viewport" content="${mobileViewport}">`;

export const assertMobileViewport = (html: string, label = "HTML page"): void => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const viewports = tags.filter(tag => /\bname\s*=\s*["']viewport["']/i.test(tag));

  if (viewports.length !== 1) {
    throw new Error(`${label} must contain exactly one viewport meta tag.`);
  }

  const content = viewports[0]?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
  if (content !== mobileViewport) {
    throw new Error(`${label} must use viewport content: ${mobileViewport}`);
  }
};

export const setMobileViewport = (html: string): string => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const viewports = tags.filter(tag => /\bname\s*=\s*["']viewport["']/i.test(tag));

  if (viewports.length > 0) {
    let out = html.replace(viewports[0] ?? "", mobileViewportTag);
    for (const duplicate of viewports.slice(1)) out = out.replace(duplicate, "");
    return out;
  }

  const head = /<head(?:\s[^>]*)?>/i;
  if (!head.test(html)) throw new Error("HTML is missing <head>.");
  return html.replace(head, match => `${match}\n  ${mobileViewportTag}`);
};
