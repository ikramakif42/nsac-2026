import { useEffect } from "react";
import { fetchQualityProducts, qualityRecordKey } from "../lib/qualityClient";
import { useStore } from "../store/useStore";
import { useQualityStore } from "../store/useQualityStore";

/**
 * Mounted by MetadataPanel even while that panel is closed.
 *
 * Inspection is on-demand: only an open inspector starts a request.
 * Scrubbing aborts old requests and waits briefly for the selection to settle.
 * Playback, URL parameters, source selection, and the main renderer are untouched.
 */
export function useQualityInspection(): void {
  const recordId = useStore((state) => state.activeRecord?.id);
  const source = useStore((state) => state.activeRecord?.source);
  const fitsUrl = useStore((state) => state.activeRecord?.fits_url);
  const open = useStore((state) => state.metaOpen);
  const retryRevision = useQualityStore((state) => state.retryRevision);

  useEffect(() => {
    const record = useStore.getState().activeRecord;
    const key = qualityRecordKey(record);

    if (!record || !key) {
      useQualityStore.getState().clear();
      return;
    }

    const current = useQualityStore.getState();
    if (current.key !== key) current.clear();

    if (!open) return;
    if (
      current.key === key &&
      current.status === "ready" &&
      current.products !== null
    ) {
      return;
    }

    const controller = new AbortController();
    const revision = useQualityStore.getState().begin(key);
    let disposed = false;
    let timedOut = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;

    const start = setTimeout(() => {
      deadline = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 60_000);

      void fetchQualityProducts(record, controller.signal)
        .then((products) => {
          if (disposed) return;
          if (qualityRecordKey(useStore.getState().activeRecord) !== key) return;

          useQualityStore.getState().resolve(key, revision, products);
        })
        .catch((error: unknown) => {
          if (disposed) return;
          const message = timedOut
            ? "Quality inspection timed out. No replacement data was used."
            : error instanceof Error
              ? error.message
              : "Quality inspection failed. No replacement data was used.";

          useQualityStore.getState().reject(key, revision, message);
        })
        .finally(() => {
          if (deadline !== undefined) clearTimeout(deadline);
        });
    }, 180);

    return () => {
      disposed = true;
      clearTimeout(start);
      if (deadline !== undefined) clearTimeout(deadline);
      controller.abort();

      const state = useQualityStore.getState();
      if (
        state.key === key &&
        state.revision === revision &&
        state.status === "loading"
      ) {
        state.clear();
      }
    };
  }, [recordId, source, fitsUrl, open, retryRevision]);
}