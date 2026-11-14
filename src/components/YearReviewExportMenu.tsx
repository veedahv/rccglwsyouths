"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { YearReviewData } from "@/lib/yearReview";
import type { ExportFormat } from "@/components/yearReviewExport";

/**
 * A "Download" button with a small menu: PDF or PowerPoint. Used on the slideshow (which already has the
 * data) and on the planner's Year in review card (which loads it first).
 */
export default function YearReviewExportMenu({
  year,
  getData,
  label = "Download",
  buttonClassName = "btn-secondary",
  statusClassName = "text-sm text-muted",
  menuAlign = "left",
}: {
  year: number;
  getData: () => Promise<YearReviewData>;
  label?: ReactNode;
  buttonClassName?: string;
  statusClassName?: string;
  menuAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(format: ExportFormat) {
    setOpen(false);
    setBusy(true);
    setStatus("Getting the slides ready…");
    try {
      const data = await getData();
      const { exportYearReview } = await import("@/components/yearReviewExport");
      await exportYearReview(data, format, (done, total) => setStatus(`Saving slide ${done} of ${total}…`));
      setStatus(`Saved your ${format === "pdf" ? "PDF" : "PowerPoint"}.`);
      setTimeout(() => setStatus(null), 3500);
    } catch (err) {
      console.error("Year in review export failed:", err);
      setStatus("Couldn't create the file. Try again in Chrome or Edge.");
      setTimeout(() => setStatus(null), 6000);
    } finally {
      setBusy(false);
    }
  }

  const item = "block w-full whitespace-nowrap px-4 py-2 text-left text-sm text-ink hover:bg-mist";

  return (
    <div className="relative flex items-center gap-3">
      {status && (
        <span role="status" className={statusClassName}>
          {status}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Download the ${year} year in review`}
          title="Download as PDF or PowerPoint"
          className={buttonClassName}
        >
          {label}
        </button>
        {open && (
          <div
            role="menu"
            className={`absolute top-full z-10 mt-2 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg ${menuAlign === "right" ? "right-0" : "left-0"}`}
          >
            <button type="button" role="menuitem" className={item} onClick={() => run("pdf")}>
              PDF <span className="text-muted">(easy to share)</span>
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => run("pptx")}>
              PowerPoint <span className="text-muted">(.pptx)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
