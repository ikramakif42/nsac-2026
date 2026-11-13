import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  SearchQuery,
  SearchResult,
  ObservationRecord,
  DataSource,
  Band,
} from "../types/cids";

export type AppStatus =
  | "idle"
  | "searching"
  | "loading_cutout"
  | "ready"
  | "error";

export type ViewMode = "2d" | "3d_sphere" | "3d_cube";

interface PlaybackState {
  epochIndex: number;    // current frame index
  isPlaying: boolean;   // always starts false
  fps: number;           // default 0.5, max 3.0
}

interface DisplaySettings {
  colormap: string;      // e.g. "viridis", "inferno"
  stretch: "linear" | "sqrt" | "log" | "asinh";
  contrastLow: number;   // percentile 0-100
  contrastHigh: number;  // percentile 0-100
  showGrid: boolean;
  showCatalog: boolean;  // Gaia overlay
}

interface AppState {
  // Query
  query: SearchQuery | null;
  result: SearchResult | null;
  status: AppStatus;
  errorMessage: string | null;

  // Active record
  activeRecord: ObservationRecord | null;
  activeSource: DataSource;
  activeBand: Band | null;

  // Playback
  playback: PlaybackState;

  // View
  viewMode: ViewMode;
  sedOpen: boolean;
  metaOpen: boolean;
  displaySettings: DisplaySettings;

  // Actions
  setQuery: (q: SearchQuery) => void;
  setResult: (r: SearchResult) => void;
  setStatus: (s: AppStatus, msg?: string) => void;
  setActiveRecord: (r: ObservationRecord | null) => void;
  setEpochIndex: (i: number) => void;
  setPlaying: (p: boolean) => void;
  setFps: (fps: number) => void;
  setViewMode: (m: ViewMode) => void;
  toggleSED: () => void;
  toggleMeta: () => void;
  updateDisplay: (patch: Partial<DisplaySettings>) => void;
  reset: () => void;
}

const DEFAULT_DISPLAY: DisplaySettings = {
  colormap: "inferno",
  stretch: "asinh",
  contrastLow: 1,
  contrastHigh: 99,
  showGrid: false,
  showCatalog: false,
};

const DEFAULT_PLAYBACK: PlaybackState = {
  epochIndex: 0,
  isPlaying: false, // CRITICAL: always starts paused
  fps: 0.5,         // CRITICAL: 0.5 fps default
};

export const useStore = create<AppState>()(
  immer((set) => ({
    query: null,
    result: null,
    status: "idle",
    errorMessage: null,
    activeRecord: null,
    activeSource: "qr3",
    activeBand: null,
    playback: DEFAULT_PLAYBACK,
    viewMode: "2d",
    sedOpen: false,
    metaOpen: false,
    displaySettings: DEFAULT_DISPLAY,

    setQuery: (q) => set((s) => { s.query = q; }),
    setResult: (r) => set((s) => { s.result = r; }),
    setStatus: (status, msg) =>
      set((s) => {
        s.status = status;
        s.errorMessage = msg ?? null;
      }),
    setActiveRecord: (r) => set((s) => { s.activeRecord = r; }),
    setEpochIndex: (i) =>
      set((s) => {
        s.playback.epochIndex = i;
      }),
    setPlaying: (p) =>
      set((s) => {
        s.playback.isPlaying = p;
      }),
    setFps: (fps) =>
      set((s) => {
        // CRITICAL: cap at 3.0 Hz
        s.playback.fps = Math.min(3.0, Math.max(0.1, fps));
      }),
    setViewMode: (m) => set((s) => { s.viewMode = m; }),
    toggleSED: () => set((s) => { s.sedOpen = !s.sedOpen; }),
    toggleMeta: () => set((s) => { s.metaOpen = !s.metaOpen; }),
    updateDisplay: (patch) =>
      set((s) => {
        Object.assign(s.displaySettings, patch);
      }),
    reset: () =>
      set((s) => {
        s.query = null;
        s.result = null;
        s.status = "idle";
        s.errorMessage = null;
        s.activeRecord = null;
        s.activeBand = null;
        s.playback = { ...DEFAULT_PLAYBACK };
      }),
  }))
);

