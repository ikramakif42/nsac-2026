import { useEffect, useId, useState } from "react";
import type { ObservationRecord } from "../types/cids";
import { useStore } from "../store/useStore";
import "./m7.css";

export interface M7InspectorProps {
  /**
   * The exact ordered comparison sequence used by the existing renderer.
   * Do not pass a mixed-band archive response unless that is the displayed
   * sequence.
   */
  records: readonly ObservationRecord[];
  embed?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  qr3: "SPHEREx QR3",
  synthetic: "SYNTHETIC",
  mast: "MAST",
  vizier: "VizieR",
  wiseview: "WiseView (AllWISE/NEOWISE)",
  gaia: "ESA Gaia DR3",
};

function finiteValue(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? String(value)
    : "Unavailable";
}

function qualityText(record: ObservationRecord): string {
  if (record.quality_ok === true) return "Pass";
  if (record.quality_ok === false) return "Flagged";
  return "Not evaluated";
}

export function M7Inspector({
  records,
  embed = false,
}: M7InspectorProps) {
  const id = useId();
  const playback = useStore((s) => s.playback);
  const activeRecord = useStore((s) => s.activeRecord);
  const activeSource = useStore((s) => s.activeSource);
  const status = useStore((s) => s.status);
  const errorMessage = useStore((s) => s.errorMessage);
  const warning = useStore((s) => s.result?.warning);
  const display = useStore((s) => s.displaySettings);
  const [consent, setConsent] = useState(false);

  const displayed = activeRecord;
  const displayedSource = displayed?.source;
  const requestedLabel = SOURCE_LABELS[activeSource];
  const displayedIndex = displayed
    ? records.findIndex((record) => record.id === displayed.id)
    : -1;

  useEffect(() => {
    useStore.getState().setPlaying(false);

    const pauseWhenHidden = () => {
      if (document.hidden) useStore.getState().setPlaying(false);
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const pauseForMotionPreference = () => {
      if (reducedMotion.matches) useStore.getState().setPlaying(false);
    };

    const pause = () => useStore.getState().setPlaying(false);

    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("pagehide", pause);
    reducedMotion.addEventListener("change", pauseForMotionPreference);

    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      window.removeEventListener("pagehide", pause);
      reducedMotion.removeEventListener("change", pauseForMotionPreference);
      pause();
    };
  }, []);

  const selectEpoch = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= records.length) {
      return;
    }
    const state = useStore.getState();
    state.setPlaying(false);
    state.setEpochIndex(index);
  };

  const canPlay = records.length > 1 && consent && status === "ready";

  return (
    <section
      className="ol-m7"
      aria-labelledby={`${id}-heading`}
      data-embed={embed ? "true" : "false"}
    >
      <h2 id={`${id}-heading`}>Observation inspection</h2>

      <div className="ol-m7-provenance">
        <span className="ol-m7-badge">
          {displayedSource
            ? SOURCE_LABELS[displayedSource]
            : `${requestedLabel} — requested; no displayed observation`}
        </span>

        {displayedSource && displayedSource !== activeSource && (
          <p>
            Displayed data are from {SOURCE_LABELS[displayedSource]}.
            Requested source: {requestedLabel}. The previous observation
            remains displayed.
          </p>
        )}

        {displayedSource === "synthetic" && (
          <p>Simulated data, not an astronomical observation.</p>
        )}
      </div>

      <p role="status" aria-atomic="true">
        {status === "searching"
          ? "Searching observations."
          : status === "loading_cutout"
            ? "Retrieving the selected observation."
            : status === "ready"
              ? "Observation data ready."
              : status === "error"
                ? "The request failed."
                : "Ready to search."}
      </p>

      {errorMessage && (
        <p className="ol-m7-notice" role="alert">
          {errorMessage}
        </p>
      )}

      {warning && <p className="ol-m7-notice">Data warning: {warning}</p>}

      <p id={`${id}-caution`}>
        Blink playback may cause discomfort. Start with static inspection
        below. Playback starts paused at 0.5 frames per second and is capped
        at 3.0 frames per second. This cap does not establish flashing safety.
      </p>

      <label className="ol-m7-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            if (!event.target.checked) {
              useStore.getState().setPlaying(false);
            }
          }}
          aria-describedby={`${id}-caution`}
        />
        Enable optional blink playback
      </label>

      <div className="ol-m7-controls">
        <button
          type="button"
          disabled={!playback.isPlaying && !canPlay}
          onClick={() => {
            useStore.getState().setPlaying(!playback.isPlaying);
          }}
          aria-describedby={`${id}-play-help`}
        >
          {playback.isPlaying ? "Pause playback" : "Play epochs"}
        </button>

        <label>
          Playback speed (frames per second)
          <input
            type="number"
            min={0.1}
            max={3}
            step={0.1}
            value={playback.fps}
            onChange={(event) => {
              useStore.getState().setFps(event.target.valueAsNumber);
            }}
          />
        </label>
      </div>

      <p id={`${id}-play-help`}>
        Playback requires at least two ready observations and explicit
        opt-in. Changing tabs pauses playback; returning does not resume it.
      </p>

      <fieldset>
        <legend>Static epoch inspection</legend>
        <p id={`${id}-index-help`}>
          Observation-index spacing, not elapsed-time spacing. Selecting an
          epoch pauses playback.
        </p>

        <label>
          Requested epoch
          <select
            value={
              records.length > 0 &&
              playback.epochIndex < records.length
                ? playback.epochIndex
                : ""
            }
            disabled={records.length === 0}
            aria-describedby={`${id}-index-help`}
            onChange={(event) => selectEpoch(Number(event.target.value))}
          >
            <option value="" disabled>
              {records.length === 0
                ? "No observations available"
                : "Select an available epoch"}
            </option>
            {records.map((record, index) => (
              <option key={record.id} value={index}>
                {index + 1}: {record.epoch_label} — {record.band} —{" "}
                {SOURCE_LABELS[record.source]}
              </option>
            ))}
          </select>
        </label>

        <div className="ol-m7-controls">
          <button
            type="button"
            disabled={records.length === 0 || playback.epochIndex <= 0}
            onClick={() => selectEpoch(playback.epochIndex - 1)}
          >
            Previous epoch
          </button>
          <button
            type="button"
            disabled={
              records.length === 0 ||
              playback.epochIndex >= records.length - 1
            }
            onClick={() => selectEpoch(playback.epochIndex + 1)}
          >
            Next epoch
          </button>
        </div>
      </fieldset>

      <h3>Displayed observation</h3>
      {displayed ? (
        <>
          <dl className="ol-m7-metadata">
            <dt>Identifier</dt>
            <dd>{displayed.id}</dd>
            <dt>Epoch</dt>
            <dd>{displayed.epoch_label}</dd>
            <dt>Modified Julian Date</dt>
            <dd>{finiteValue(displayed.epoch_mjd)}</dd>
            <dt>Time scale</dt>
            <dd>Not specified by the CIDS observation record</dd>
            <dt>Detector / band</dt>
            <dd>{displayed.array_id ?? displayed.band}</dd>
            <dt>Wavelength</dt>
            <dd>{finiteValue(displayed.wavelength_um)} μm</dd>
            <dt>Backend signal-to-noise ratio</dt>
            <dd>{finiteValue(displayed.snr)}</dd>
            <dt>Backend quality result</dt>
            <dd>{qualityText(displayed)}</dd>
            <dt>Raw quality flags</dt>
            <dd>{finiteValue(displayed.quality_flags)}</dd>
            <dt>Requested display stretch</dt>
            <dd>{display.stretch}</dd>
            <dt>Requested color map</dt>
            <dd>{display.colormap}</dd>
          </dl>

          {displayedIndex !== playback.epochIndex && (
            <p className="ol-m7-notice">
              The requested epoch is not the displayed observation.
              Interpret the displayed observation metadata until retrieval
              and rendering finish.
            </p>
          )}
        </>
      ) : (
        <p>No observation is currently displayed.</p>
      )}

      <details>
        <summary>Accessible observation list</summary>
        <p>
          This list exposes backend metadata without requiring the canvas.
          It is not a textual reconstruction of image morphology.
        </p>
        <ol className="ol-m7-observations">
          {records.map((record, index) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => selectEpoch(index)}
                aria-current={
                  index === playback.epochIndex ? "step" : undefined
                }
              >
                Inspect epoch {index + 1}: {record.epoch_label}
              </button>
              <p>
                {SOURCE_LABELS[record.source]}; {record.band};{" "}
                {finiteValue(record.wavelength_um)} μm; MJD{" "}
                {finiteValue(record.epoch_mjd)}; quality{" "}
                {qualityText(record)}; SNR {finiteValue(record.snr)}.
              </p>
            </li>
          ))}
        </ol>
      </details>

      <p>
        Possible motion or variability is an investigation candidate, not a
        confirmed discovery. Check registration, wavelength, coverage, and
        backend quality information before interpreting differences.
      </p>
    </section>
  );
}