import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { YearReviewData } from "@/lib/yearReview";
import { ExportModeContext, SlideShell, YEAR_REVIEW_CSS, buildSlides } from "@/components/YearReviewSlides";

// Saves the year-in-review slideshow as a PDF or a PowerPoint file. Each slide is drawn off-screen
// at the same 1280 x 720 size as the slideshow, photographed to an image, and the images are put
// one per page / slide. The slides are pictures (they look exactly like the slideshow, but the
// text in them can't be edited). Everything loads on demand, so it adds nothing to the page until
// someone asks for a file.

export type ExportFormat = "pdf" | "pptx";

const W = 1280;
const H = 720;
const RATIO = 1.5; // 1920 x 1080 pictures: sharp on a projector without making the file huge

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function imagesLoaded(el: HTMLElement): Promise<void> {
  const pending = Array.from(el.querySelectorAll("img")).filter((img) => !img.complete);
  await Promise.all(pending.map((img) => new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); })));
}

export function exportFileName(year: number, format: ExportFormat): string {
  return `LWS-Youths-Year-in-Review-${year}.${format}`;
}

export async function exportYearReview(
  data: YearReviewData,
  format: ExportFormat,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const slides = buildSlides(data);
  const { toJpeg } = await import("html-to-image");

  // The slides are drawn inside a box that is pushed off-screen. The box we photograph sits inside it,
  // so its own position is normal and doesn't get copied into the picture.
  const offscreen = document.createElement("div");
  Object.assign(offscreen.style, { position: "fixed", left: "-10000px", top: "0", width: `${W}px`, height: `${H}px`, pointerEvents: "none" });
  offscreen.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div");
  stage.className = "yr-export";
  Object.assign(stage.style, { position: "relative", width: `${W}px`, height: `${H}px`, overflow: "hidden" });
  offscreen.appendChild(stage);
  document.body.appendChild(offscreen);
  const root = createRoot(stage);

  const pictures: string[] = [];
  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      flushSync(() =>
        root.render(
          <ExportModeContext.Provider value={true}>
            <style>{YEAR_REVIEW_CSS}</style>
            <SlideShell theme={slide.theme} seed={i}>
              {slide.node}
            </SlideShell>
          </ExportModeContext.Provider>
        )
      );
      await document.fonts?.ready;
      await nextFrame();
      await nextFrame();
      await imagesLoaded(stage);

      const options = { width: W, height: H, pixelRatio: RATIO, quality: 0.92, backgroundColor: "#ffffff" };
      // The first picture can come out without its fonts or logo; taking it twice makes sure they are in.
      if (i === 0) await toJpeg(stage, options);
      pictures.push(await toJpeg(stage, options));
      onProgress?.(i + 1, slides.length);
    }
  } finally {
    root.unmount();
    offscreen.remove();
  }

  const fileName = exportFileName(data.year, format);

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H], hotfixes: ["px_scaling"], compress: true });
    pictures.forEach((picture, i) => {
      if (i > 0) pdf.addPage([W, H], "landscape");
      pdf.addImage(picture, "JPEG", 0, 0, W, H, undefined, "FAST");
    });
    pdf.setProperties({ title: `LWS RCCG Youths: Year in Review ${data.year}` });
    pdf.save(fileName);
    return;
  }

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in: the same 16:9 shape as the slides
  pptx.title = `LWS RCCG Youths: Year in Review ${data.year}`;
  for (const picture of pictures) {
    const slide = pptx.addSlide();
    // pptxgenjs wants the image as "image/jpeg;base64,..." (no leading "data:").
    slide.addImage({ data: picture.replace(/^data:/, ""), x: 0, y: 0, w: 13.333, h: 7.5 });
  }
  await pptx.writeFile({ fileName });
}
