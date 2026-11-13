import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store/useStore";
import { BENCHMARK_TARGETS } from "../types/cids";
import syntheticConnector from "../connectors/synthetic";

describe("ORBIT-LENS Store, 6-Array Calibration & CIDS Sanity Tests", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("enforces playback safety defaults", () => {
    const state = useStore.getState();
    expect(state.playback.isPlaying).toBe(false); // CRITICAL: starts paused
    expect(state.playback.fps).toBe(0.5);          // CRITICAL: 0.5 fps default
    expect(state.playback.epochIndex).toBe(0);
    expect(state.fov.fovDeg).toBe(5.0);            // 5-degree macro chunk default
  });

  it("caps playback speed strictly at 3.0 Hz", () => {
    const { setFps } = useStore.getState();
    setFps(10.0); // Attempt to exceed limit
    expect(useStore.getState().playback.fps).toBe(3.0);

    setFps(0.01); // Attempt below min
    expect(useStore.getState().playback.fps).toBe(0.1);
  });

  it("performs smooth wheel scrubbing through epochs", () => {
    const { stepEpoch } = useStore.getState();
    stepEpoch(1, 10);
    expect(useStore.getState().playback.epochIndex).toBe(1);

    stepEpoch(5, 10);
    expect(useStore.getState().playback.epochIndex).toBe(6);

    // Should clamp at bounds
    stepEpoch(10, 10);
    expect(useStore.getState().playback.epochIndex).toBe(9);

    stepEpoch(-20, 10);
    expect(useStore.getState().playback.epochIndex).toBe(0);
  });

  it("contains all 5 NASA challenge benchmark targets", () => {
    expect(BENCHMARK_TARGETS.length).toBe(5);
    const labels = BENCHMARK_TARGETS.map((t) => t.label);
    expect(labels).toContain("Barnard's Star");
    expect(labels).toContain("Epsilon Indi B");
    expect(labels).toContain("WISE 0855");
    expect(labels).toContain("RW Aurigae");
    expect(labels).toContain("R Draconis");
  });

  it("retrieves synthetic observations across all 6 detector arrays", async () => {
    const result = await syntheticConnector.search({ ra: 269.4521, dec: 4.6934 });
    expect(result.source_used).toBe("synthetic");
    // 4 epochs * 6 arrays = 24 records
    expect(result.records.length).toBe(24);
    expect(result.warning?.toUpperCase()).toContain("SYNTHETIC DATA");

    // Verify 6 distinct arrays are present
    const bands = new Set(result.records.map((r) => r.band));
    expect(bands.has("Array1")).toBe(true);
    expect(bands.has("Array2")).toBe(true);
    expect(bands.has("Array3")).toBe(true);
    expect(bands.has("Array4")).toBe(true);
    expect(bands.has("Array5")).toBe(true);
    expect(bands.has("Array6")).toBe(true);
  });

  it("calculates 5-degree active and prefetch tiles", async () => {
    const tileRes = await syntheticConnector.fetchTiles({ ra: 269.4521, dec: 4.6934, fov_deg: 5.0 });
    expect(tileRes.active_tile.fov_deg).toBe(5.0);
    expect(tileRes.active_tile.tile_id).toBeDefined();
  });

  it("retrieves 3D Time-Cube metadata", async () => {
    const cube = await syntheticConnector.fetchCube("test_rec", "time");
    expect(cube.axis).toBe("time");
    expect(cube.dimensions[2]).toBe(4);
    expect(cube.slices.length).toBe(4);
  });
});
