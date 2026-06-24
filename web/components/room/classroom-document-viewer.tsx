"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LessonWorksheet } from "@/lib/types";

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

const PDF_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

function isPdfWorksheet(worksheet: LessonWorksheet | null) {
  return worksheet?.file_mime_type === "application/pdf";
}

function isImageWorksheet(worksheet: LessonWorksheet | null) {
  return worksheet?.file_mime_type?.startsWith("image/") ?? false;
}

export function ClassroomDocumentViewer({
  compact = false,
  signedUrl,
  worksheet,
}: {
  compact?: boolean;
  signedUrl: string | null;
  worksheet: LessonWorksheet | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageFrameRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1);

  const isPdf = isPdfWorksheet(worksheet);
  const isImage = isImageWorksheet(worksheet);
  const pdfSourceUrl = isPdf && signedUrl ? signedUrl : null;

  useEffect(() => {
    const sourceUrl = pdfSourceUrl ?? "";

    if (!sourceUrl) {
      return;
    }

    let isMounted = true;

    async function loadPdf() {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const loadingTask = pdfjs.getDocument({ url: sourceUrl });
        const loadedDocument = await loadingTask.promise;

        if (!isMounted) {
          return;
        }

        setPdfDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
        setPageNumber(1);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to render this PDF worksheet.",
          );
          setPdfDocument(null);
          setPageCount(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      isMounted = false;
      renderTaskRef.current?.cancel();
    };
  }, [pdfSourceUrl]);

  const renderPdfPage = useCallback(async () => {
    const canvas = canvasRef.current;
    const frame = pageFrameRef.current;

    if (!canvas || !frame || !pdfDocument) {
      return;
    }

    renderTaskRef.current?.cancel();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const maxWidth = Math.max(frame.clientWidth - 32, 320);
      const fitScale = maxWidth / unscaledViewport.width;
      const viewport = page.getViewport({
        scale: Math.max(0.35, Math.min(fitScale * zoom, 2.75)),
      });
      const pixelRatio = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("This browser cannot render the worksheet canvas.");
      }

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (error) {
      if (error instanceof Error && error.name === "RenderingCancelledException") {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to render this PDF page.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pageNumber, pdfDocument, zoom]);

  useEffect(() => {
    if (!pdfDocument) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void renderPdfPage();
    });

    const frame = pageFrameRef.current;

    if (!frame) {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(() => {
      void renderPdfPage();
    });
    observer.observe(frame);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [pdfDocument, renderPdfPage]);

  if (!worksheet?.file_path) {
    return (
      <div
        className={`flex h-full flex-col justify-between rounded-2xl bg-white p-5 text-slate-950 ${
          compact ? "min-h-0 shadow-none" : "min-h-[260px] shadow-2xl"
        }`}
      >
        <div className="space-y-3">
          <Badge>Question preview</Badge>
          <div>
            <p className="font-bold text-blue-700">SPM Mathematics</p>
            <p className="mt-1 text-sm text-slate-700">
              Topic: Quadratic Equations
            </p>
          </div>
        </div>
        <div className="space-y-4 py-6">
          <p className="text-sm">1. Solve the following quadratic equation.</p>
          <div className="text-center text-2xl font-semibold italic lg:text-3xl">
            x^2 - 5x + 6 = 0
          </div>
          <div className="text-right text-sm">[3 marks]</div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-slate-800">
            Upload a worksheet PDF or image to replace this sample question.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col rounded-2xl bg-white text-slate-950 ${
        compact ? "min-h-0 shadow-none" : "min-h-[260px] shadow-2xl"
      }`}
    >
      <div
        className={`flex flex-col gap-3 border-b border-slate-200 p-4 ${
          compact ? "" : "lg:flex-row lg:items-center lg:justify-between"
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge>Uploaded worksheet</Badge>
            <Badge className="bg-slate-100 text-slate-600">
              {isPdf ? "PDF pages" : isImage ? "Image page" : "File"}
            </Badge>
          </div>
          <h2
            className={`mt-2 truncate font-black text-slate-950 ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {worksheet.title}
          </h2>
          <p className="truncate text-xs text-slate-500">
            {worksheet.file_name ?? "Worksheet file"}
          </p>
        </div>

        {isPdf ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              variant="secondary"
            >
              Previous
            </Button>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
              Page {pageNumber} / {pageCount || "-"}
            </span>
            <Button
              disabled={!pageCount || pageNumber >= pageCount}
              onClick={() =>
                setPageNumber((current) => Math.min(pageCount, current + 1))
              }
              variant="secondary"
            >
              Next
            </Button>
            <select
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950"
              onChange={(event) => setZoom(Number(event.target.value))}
              value={zoom}
            >
              <option value={0.75}>75%</option>
              <option value={1}>100%</option>
              <option value={1.25}>125%</option>
              <option value={1.5}>150%</option>
            </select>
          </div>
        ) : null}
      </div>

      <div
        className={`flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 ${
          compact ? "min-h-0" : "min-h-[260px]"
        }`}
        ref={pageFrameRef}
      >
        {!signedUrl ? (
          <p className="text-center text-sm font-semibold text-slate-500">
            Preparing worksheet file...
          </p>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={worksheet.file_name ?? "Uploaded worksheet"}
            className={`max-w-full rounded-xl bg-white object-contain shadow-lg ${
              compact ? "max-h-full" : "max-h-[52vh]"
            }`}
            src={signedUrl}
          />
        ) : isPdf ? (
          <div className="relative">
            <canvas className="rounded-xl bg-white shadow-lg" ref={canvasRef} />
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/75 text-sm font-semibold text-slate-500">
                Rendering page...
              </div>
            ) : null}
          </div>
        ) : (
          <a
            className="text-sm font-semibold text-blue-700 underline"
            href={signedUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open worksheet file
          </a>
        )}
      </div>

      {errorMessage ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
