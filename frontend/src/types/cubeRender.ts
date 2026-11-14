import type { TimeCubeMetadata } from "./cids";

export interface CubeRenderFrame {
  record_id: string;
  rgba_base64: string;
  valid_fraction: number;
  median_snr: number | null;
}

export interface CubeRenderResponse {
  metadata: TimeCubeMetadata;
  record_ids: string[];
  texture_width: number;
  texture_height: number;
  frames: CubeRenderFrame[];
  cube: {
    width: number;
    height: number;
    z_positions: number[];
  };
  sphere: {
    positions: number[];
    uv: number[];
    indices: number[];
    center: [number, number, number];
    north: [number, number, number];
    angular_radius_rad: number;
  };
  display_range: [number, number];
  unit: string;
  warnings: string[];
}

export interface CubeDisplayOptions {
  stretch: "linear" | "sqrt" | "log" | "asinh";
  colormap: string;
  contrastLow: number;
  contrastHigh: number;
}