import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
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

export type ViewMode = "sky_map" | "3d_cube" | "2d" | "3d_sphere";

export const DEFAULT_FPS = 0.5;
export const MIN_FPS = 0.1;
export const MAX_FPS = 3;

export interface PlaybackState {
  epochIndex: number;
  isPlaying: boolean;
  fps: number;
}

export interface DisplaySettings {
  colormap: string;
  stretch: "linear" | "sqrt" | "log" | "asinh";
  contrastLow: number;
  contrastHigh: number;
  showGrid: boolean;
  showCatalog: boolean;
  cdsOverlay: CDSOverlay;
}

export interface FOVState {
  centerRa: number;
  centerDec: number;
  fovDeg: number;
  activeTile: TileChunk | null;
  prefetchTiles: TileChunk[];
}

export interface AppState {
  query: SearchQuery | null;
  result: SearchResult | null;
  status: AppStatus;
  errorMessage: string | null;
  activeRecord: ObservationRecord | null;
  activeSource: DataSource;
  activeBand: Band | null;
  playback: PlaybackState;
  fov: FOVState;
  cubeAxis: CubeAxis;
  viewMode: ViewMode;
  sedOpen: boolean;
  metaOpen: boolean;
  displaySettings: DisplaySettings;

  setActiveSource: (source: DataSource) => void;
  setQuery: (q: SearchQuery) => void;
  setResult: (r: SearchResult) => void;
  setStatus: (s: AppStatus, msg?: string) => void;
  setActiveRecord: (r: ObservationRecord | null) => void;
  setEpochIndex: (i: number) => void;
  stepEpoch: (delta: number, maxFrames: number) => void;
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

function defaultDisplay(): DisplaySettings {
  return {
    colormap: "inferno",
    stretch: "asinh",
    contrastLow: 1,
    contrastHigh: 99,
    showGrid: false,
    showCatalog: false,
    cdsOverlay: "none",
  };
}

function defaultPlayback(): PlaybackState {
  return {
    epochIndex: 0,
    isPlaying: false,
    fps: DEFAULT_FPS,
  };
}

function defaultFOV(): FOVState {
  return {
    centerRa: 269.4521,
    centerDec: 4.6934,
    fovDeg: 5,
    activeTile: null,
    prefetchTiles: [],
  };
}

export function normalizeFps(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_FPS;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, value));
}

function normalizeIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export const CODE_BUILD_SIG = "orbit-lens-v1.6.0-default-synthetic";

// Automatically wipe client-side storage whenever codebase build changes
if (typeof window !== "undefined") {
  try {
    const storedSig = localStorage.getItem("orbit_lens_build_sig");
    if (storedSig && storedSig !== CODE_BUILD_SIG) {
      console.info("[Storage] Codebase updated. Auto-wiping client-side storage cache.");
      localStorage.removeItem("orbit-lens-state");
    }
    localStorage.setItem("orbit_lens_build_sig", CODE_BUILD_SIG);
  } catch {
    // Ignore storage quota or access issues
  }
}

export const useStore = create<AppState>()(
  persist(
    immer((set) => ({
    query: null,
    result: null,
    status: "idle",
    errorMessage: null,
    activeRecord: null,
    activeSource: "synthetic",
    activeBand: null,
    playback: defaultPlayback(),
    fov: defaultFOV(),
    cubeAxis: "time",
    viewMode: "sky_map",
    sedOpen: false,
    metaOpen: false,
    displaySettings: defaultDisplay(),

    setActiveSource: (source) =>
      set((s) => {
        if (s.activeSource !== source) s.playback.isPlaying = false;
        s.activeSource = source;
      }),

    setQuery: (q) =>
      set((s) => {
        s.query = q;
        s.playback.isPlaying = false;
      }),

    setResult: (r) =>
      set((s) => {
        s.result = r;
      }),

    setStatus: (status, msg) =>
      set((s) => {
        s.status = status;
        s.errorMessage = msg ?? null;
        if (status !== "ready") s.playback.isPlaying = false;
      }),

    setActiveRecord: (r) =>
      set((s) => {
        s.activeRecord = r;
      }),

    setEpochIndex: (i) =>
      set((s) => {
        s.playback.epochIndex = normalizeIndex(i);
      }),

    stepEpoch: (delta, maxFrames) =>
      set((s) => {
        if (!Number.isFinite(maxFrames) || maxFrames <= 0) {
          s.playback.epochIndex = 0;
          s.playback.isPlaying = false;
          return;
        }

        const count = Math.floor(maxFrames);
        if (count <= 1) {
          s.playback.epochIndex = 0;
          s.playback.isPlaying = false;
          return;
        }

        const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
        s.playback.epochIndex = Math.max(
          0,
          Math.min(count - 1, s.playback.epochIndex + step),
        );
      }),

    setPlaying: (playing) =>
      set((s) => {
        s.playback.fps = normalizeFps(s.playback.fps);
        s.playback.isPlaying = playing;
      }),

    setFps: (fps) =>
      set((s) => {
        s.playback.fps = normalizeFps(fps);
      }),

    setViewMode: (mode) =>
      set((s) => {
        if (s.viewMode !== mode) s.playback.isPlaying = false;
        s.viewMode = mode;
      }),

    setCubeAxis: (axis) =>
      set((s) => {
        if (s.cubeAxis !== axis) s.playback.isPlaying = false;
        s.cubeAxis = axis;
      }),

    setCDSOverlay: (overlay) =>
      set((s) => {
        s.displaySettings.cdsOverlay = overlay;
      }),

    setFOV: (patch) =>
      set((s) => {
        Object.assign(s.fov, patch);
      }),

    toggleSED: () =>
      set((s) => {
        s.sedOpen = !s.sedOpen;
      }),

    toggleMeta: () =>
      set((s) => {
        s.metaOpen = !s.metaOpen;
      }),

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
        s.activeSource = "synthetic";
        s.activeBand = null;
        s.playback = defaultPlayback();
        s.fov = defaultFOV();
        s.cubeAxis = "time";
        s.viewMode = "2d";
        s.sedOpen = false;
        s.metaOpen = false;
        s.displaySettings = defaultDisplay();
      }),
  })),
  {
    name: "orbit-lens-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      activeSource: state.activeSource,
      fov: state.fov,
      viewMode: state.viewMode,
      displaySettings: state.displaySettings,
      playback: {
        epochIndex: state.playback.epochIndex,
        isPlaying: false,
        fps: state.playback.fps,
      },
    }),
  }
)
);