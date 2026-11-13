import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  SearchQuery,
  SearchResult,
  ObservationRecord,
  DataSource,
  Band,
  CDSOverlay,
  CubeAxis,
  TileChunk,
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
  cdsOverlay: CDSOverlay;
}

interface FOVState {
  centerRa: number;
  centerDec: number;
  fovDeg: number;       // default 5.0 degrees
  activeTile: TileChunk | null;
  prefetchTiles: TileChunk[];
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

  // Playback & Temporal Wheel Scrubbing
  playback: PlaybackState;

  // Progressive FOV & Tiling
  fov: FOVState;

  // 3D Time-Cube Mode
  cubeAxis: CubeAxis;

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
  stepEpoch: (delta: number, maxFrames: number) => void; // Wheel scrub action
  setPlaying: (p: boolean) => void;
  setFps: (fps: number) => void;
  setViewMode: (m: ViewMode) => void;
  setCubeAxis: (axis: CubeAxis) => void;
  setCDSOverlay: (overlay: CDSOverlay) => void;
  setFOV: (patch: Partial<FOVState>) => void;
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
  cdsOverlay: "none",
};

const DEFAULT_PLAYBACK: PlaybackState = {
  epochIndex: 0,
  isPlaying: false, // CRITICAL: always starts paused
  fps: 0.5,         // CRITICAL: 0.5 fps default
};

const DEFAULT_FOV: FOVState = {
  centerRa: 269.4521,
  centerDec: 4.6934,
  fovDeg: 5.0,
  activeTile: null,
  prefetchTiles: [],
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
    fov: DEFAULT_FOV,
    cubeAxis: "time",
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
    stepEpoch: (delta, maxFrames) =>
      set((s) => {
        if (maxFrames <= 1) return;
        const next = Math.max(0, Math.min(maxFrames - 1, s.playback.epochIndex + delta));
        s.playback.epochIndex = next;
      }),
    setPlaying: (p) =>
      set((s) => {
        s.playback.isPlaying = p;
      }),
    setFps: (fps) =>
      set((s) => {
        // CRITICAL: strict 3.0 Hz upper limit
        s.playback.fps = Math.min(3.0, Math.max(0.1, fps));
      }),
    setViewMode: (m) => set((s) => { s.viewMode = m; }),
    setCubeAxis: (axis) => set((s) => { s.cubeAxis = axis; }),
    setCDSOverlay: (overlay) => set((s) => { s.displaySettings.cdsOverlay = overlay; }),
    setFOV: (patch) => set((s) => { Object.assign(s.fov, patch); }),
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
        s.fov = { ...DEFAULT_FOV };
        s.cubeAxis = "time";
      }),
  }))
);
