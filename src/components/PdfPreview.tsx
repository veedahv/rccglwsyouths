"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a PDF's pages in the page itself, the way they'll print, so a
 * document can be checked without downloading it. Pages are drawn onto
 * canvases with pdf.js, which (unlike an <iframe> of the PDF) works the
 * same on phones as on a computer.
 */
export default function PdfPreview({ data }: { data: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let task: any;
    setState("loading");

    (async () => {
      try {
        // Loaded on demand: pdf.js is large and only the preview needs it.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.js",
          import.meta.url
        ).toString();

        task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        const pdf = await task.promise;
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.replaceChildren();

        const width = container.clientWidth;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const cssScale = width / base.width;
          const viewport = page.getViewport({ scale: cssScale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${base.height * cssScale}px`;
          canvas.className = "mb-4 block rounded bg-white shadow-md last:mb-0";
          canvas.setAttribute("aria-label", `Page ${n} of ${pdf.numPages}`);
          container.appendChild(canvas);

          const context = canvas.getContext("2d");
          if (!context) throw new Error("no canvas");
          await page.render({ canvasContext: context, viewport }).promise;
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy?.();
    };
  }, [data]);

  return (
    <div className="relative mx-auto max-w-3xl">
      <div ref={containerRef} />
      {state === "loading" && <p className="py-16 text-center text-sm text-muted">Preparing the preview…</p>}
      {state === "error" && (
        <p className="py-16 text-center text-sm text-rccg-red-600">
          Couldn&apos;t show the preview here. You can still download the PDF.
        </p>
      )}
    </div>
  );
}
