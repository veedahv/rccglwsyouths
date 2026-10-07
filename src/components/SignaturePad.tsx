"use client";

import { useEffect, useRef, useState } from "react";

// Fixed size so the PDF can place every signature in the same 5:2 box
// (lib/eventDocumentPdf.ts). Transparent background, so it prints cleanly
// on the letter; the PNG is only a few KB, well inside a Firestore document.
export const SIGNATURE_W = 400;
export const SIGNATURE_H = 160;

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

/** A small "sign here" box: draw with a finger, stylus or mouse. */
export default function SignaturePad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#180C62";
    ctx.fillStyle = "#180C62";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    ctx.beginPath(); // a single tap leaves a dot
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    setHasInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function stop() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="panel space-y-3">
      <p className="text-sm text-muted">Sign inside the box, then press Use this signature.</p>
      <canvas
        ref={canvasRef}
        width={SIGNATURE_W}
        height={SIGNATURE_H}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        aria-label="Signature box"
        className="aspect-[5/2] w-full max-w-sm touch-none rounded-lg border border-dashed border-rccg-purple-300 bg-white"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={!hasInk} className="btn-primary btn-sm">
          Use this signature
        </button>
        <button type="button" onClick={clear} className="btn-secondary btn-sm">
          Clear
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
