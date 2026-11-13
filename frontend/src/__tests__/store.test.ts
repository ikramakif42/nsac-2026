import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store/useStore";
import { BENCHMARK_TARGETS } from "../types/cids";
import syntheticConnector from "../connectors/synthetic";

describe("ORBIT-LENS Store & CIDS Sanity Tests", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("enforces playback safety defaults", () => {
    const state = useStore.getState();
    expect(state.playback.isPlaying).toBe(false); // CRITICAL: starts paused
    expect(state.playback.fps).toBe(0.5);          // CRITICAL: 0.5 fps default
    expect(state.playback.epochIndex).toBe(0);
  });

  it("caps playback speed strictly at 3.0 Hz", () => {
    const { setFps } = useStore.getState();
    setFps(10.0); // Attempt to exceed limit
    expect(useStore.getState().playback.fps).toBe(3.0);

    setFps(0.01); // Attempt below min
    expect(useStore.getState().playback.fps).toBe(0.1);
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

  it("retrieves deterministic synthetic search records", async () => {
    const result = await syntheticConnector.search({ ra: 269.4521, dec: 4.6934 });
    expect(result.source_used).toBe("synthetic");
    expect(result.records.length).toBe(8);
    expect(result.warning?.toUpperCase()).toContain("SYNTHETIC DATA");
    expect(result.records[0].quality_ok).toBe(true);
  });
});
