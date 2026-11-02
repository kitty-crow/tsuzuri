import { observePage } from "../読取/observe.ts";
import { SOURCE_LIMIT } from "../読取/source.ts";
import type { PageCapture } from "./protocol.ts";

/** This property lives in the extension's isolated world, not the website's JS world. */
const isolated = globalThis as typeof globalThis & { __tsuzuriCapture?: () => PageCapture };
isolated.__tsuzuriCapture = (): PageCapture => {
    const elements = [document.body, ...document.body.querySelectorAll<HTMLElement>("*")];
    const previous = elements.map((element) => element.getAttribute("data-tsuzuri-source"));
    try {
        const graph = observePage(document, innerWidth, innerHeight);
        const html = document.documentElement.outerHTML;
        if (new TextEncoder().encode(html).byteLength > SOURCE_LIMIT) throw new Error("ページが大きすぎます（上限2 MiB）。");
        return { url: location.href, html, graph };
    } finally {
        elements.forEach((element, index) => {
            const value = previous[index];
            if (value === null || value === undefined) { element.removeAttribute("data-tsuzuri-source"); return; }
            element.setAttribute("data-tsuzuri-source", value);
        });
    }
};
