import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import type { ObservationRecord } from "../../types/cids";
import SourceBadge from "../TopBar/SourceBadge";
import {
  checkedResponse,
  OVERLAY_LABELS,
  overlayURL,
  readOverlay,
  scienceRGBA,
  supportedOverlay,
  type ReferenceMetadata,
  type ReferenceRequest,
} from "./cdsReference";

interface Props {
  record: ObservationRecord | null;
  apiBase?: string;
}

interface LoadedReference {
  key: string;
  url: string;
  metadata: ReferenceMetadata;
}

export default function CDSReferencePanel({
  record,
  apiBase = "/api",
}: Props) {
  const overlay = useStore((state) => state.displaySettings.cdsOverlay);
  const setOverlay = useStore((state) => state.setCDSOverlay);
  const fov = useStore((state) => state.fov);
  const activeSource = useStore((state) => state.activeSource);
  const [opacity, setOpacity] = useState(0.5);
  const [loaded, setLoaded] = useState<LoadedReference | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [scienceError, setScienceError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const id = useId();

  useEffect(() => {
    const restore = () => {
      useStore.getState().setCDSOverlay(readOverlay(window.location.search));
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const request: ReferenceRequest | null = supportedOverlay(overlay)
    ? {
        overlay,
        ...(record ? { wcs: record.wcs } : {}),
        ra: record?.ra_center ?? fov.centerRa,
        dec: record?.dec_center ?? fov.centerDec,
        fov_deg: fov.fovDeg,
        width: 768,
        height: 768,
      }
    : null;

  const requestKey = request ? JSON.stringify(request) : "";
  const current = loaded?.key === requestKey ? loaded : null;
  const error = failure?.key === requestKey ? failure.message : null;
  const pixels = record?.fits_hdus?.hdu1_science;
  const width = record?.wcs.naxis1 ?? 768;
  const height = record?.wcs.naxis2 ?? 768;
  const hasScience =
    !!pixels &&
    width >= 1 &&
    height >= 1 &&
    width <= 2048 &&
    height <= 2048 &&
    pixels.length === width * height;

  useEffect(() => {
    if (!requestKey) {
      setLoaded(null);
      setFailure(null);
      return;
    }

    const controller = new AbortController();
    let objectURL: string | null = null;
    let active = true;
    setLoaded(null);
    setFailure(null);

    const options: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestKey,
      signal: controller.signal,
    };

    async function load() {
      try {
        const base = apiBase.replace(/\/$/, "");
        const [metadataResponse, imageResponse] = await Promise.all([
          fetch(`${base}/cds/metadata`, options).then(checkedResponse),
          fetch(`${base}/cds/render`, options).then(checkedResponse),
        ]);
        const metadata: ReferenceMetadata = await metadataResponse.json();
        const blob = await imageResponse.blob();
        if (!blob.type.startsWith("image/jpeg")) {
          throw new Error("The reference service did not return a JPEG image.");
        }
        if (!active) return;
        objectURL = URL.createObjectURL(blob);
        setLoaded({ key: requestKey, url: objectURL, metadata });
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        setFailure({
          key: requestKey,
          message: reason instanceof Error ? reason.message : "CDS imagery unavailable.",
        });
        controller.abort();
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [apiBase, requestKey, retry]);

  useEffect(() => {
    setScienceError(null);
    if (!requestKey || !hasScience || !pixels || !canvas.current) return;
    try {
      const context = canvas.current.getContext("2d");
      if (!context) throw new Error("The science comparison canvas is unavailable.");
      const image = context.createImageData(width, height);
      image.data.set(scienceRGBA(pixels, width, height));
      context.putImageData(image, 0, 0);
    } catch (reason) {
      setScienceError(
        reason instanceof Error ? reason.message : "Science image display failed.",
      );
    }
  }, [requestKey, hasScience, pixels, width, height]);

  const selectOverlay = (value: string) => {
    const next = supportedOverlay(value) ? value : "none";
    setOverlay(next);
    const url = overlayURL(window.location.href, next);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <section
      aria-label="CDS reference comparison"
      className="shrink-0 border-t border-[var(--ol-border)] bg-[var(--ol-surface)] p-3 text-xs"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-survey`}>CDS reference</label>
        <select
          id={`${id}-survey`}
          value={supportedOverlay(overlay) ? overlay : "none"}
          onChange={(event) => selectOverlay(event.target.value)}
          className="rounded border border-[var(--ol-border)] bg-[var(--ol-bg)] p-1"
        >
          <option value="none">Off</option>
          {Object.entries(OVERLAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <SourceBadge source={record?.source ?? activeSource} />
        {overlay === "panstarrs" && (
          <span role="status">Pan-STARRS is not configured for this milestone.</span>
        )}
      </div>

      {request && (
        <div className="mt-3 flex flex-wrap gap-4">
          <div
            className="relative overflow-hidden bg-black"
            style={{
              width: "min(100%, 320px)",
              aspectRatio: `${width} / ${height}`,
              maxHeight: 320,
            }}
            aria-label="Registered reference image plane"
          >
            {hasScience && (
              <canvas
                ref={canvas}
                width={width}
                height={height}
                aria-label="Science image, display-only asinh stretch"
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            )}
            {current && !error && (
              <img
                key={current.url}
                src={current.url}
                alt={`${current.metadata.survey} reference in the backend-defined TAN image plane`}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (
                    image.naturalWidth !== current.metadata.width ||
                    image.naturalHeight !== current.metadata.height
                  ) {
                    setFailure({
                      key: requestKey,
                      message: "CDS image dimensions do not match the requested WCS.",
                    });
                  }
                }}
                onError={() => setFailure({
                  key: requestKey,
                  message: "The CDS reference image could not be decoded.",
                })}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: hasScience && !scienceError ? opacity : 1,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          <div className="max-w-md space-y-2">
            <p>
              <strong>{OVERLAY_LABELS[request.overlay]}</strong>
              {" · CDS HiPS reference"}
            </p>
            <p>
              {hasScience && !scienceError
                ? "Registered comparison with decoded science pixels. The main viewer is unchanged."
                : "Reference only: decoded science pixels are not available for blending."}
            </p>
            {hasScience && !scienceError && (
              <label className="flex items-center gap-2">
                Reference opacity
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
                <output>{Math.round(opacity * 100)}%</output>
              </label>
            )}
            {!current && !error && <p role="status">Loading CDS imagery…</p>}
            {scienceError && <p role="alert">{scienceError}</p>}
            {error && (
              <div role="alert">
                <p>{error} No substitute data was used.</p>
                <button
                  type="button"
                  className="mt-1 rounded border px-2 py-1"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Retry
                </button>
              </div>
            )}
            {current && (
              <>
                <p>{current.metadata.warning}</p>
                <nav aria-label="CDS tools" className="flex flex-wrap gap-3">
                  {Object.entries(current.metadata.links).map(([name, href]) => (
                    <a
                      key={name}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {name === "simbad" ? "SIMBAD" : name === "vizier" ? "VizieR" : "Aladin"}
                      {" ↗"}
                    </a>
                  ))}
                  <a
                    href={`${current.metadata.hips_url}/properties`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Survey provenance ↗
                  </a>
                </nav>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}