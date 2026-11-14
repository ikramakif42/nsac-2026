import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store/useStore";
import {
  createDeepLink,
  parseDeepLink,
  type DeepLinkState,
} from "./deepLink";

const defaults: DeepLinkState = {
  ra: 269.4521,
  dec: 4.6934,
  fov: 5,
  source: "synthetic",
  epoch: 0,
  embed: false,
};

beforeEach(() => {
  useStore.getState().reset();
});

describe("M7 playback state", () => {
  it("starts paused at 0.5 fps", () => {
    expect(useStore.getState().playback).toEqual({
      epochIndex: 0,
      isPlaying: false,
      fps: 0.5,
    });
  });

  it.each([
    [Number.NaN, 0.5],
    [Number.POSITIVE_INFINITY, 3],
    [Number.NEGATIVE_INFINITY, 0.1],
    [-1, 0.1],
    [0, 0.1],
    [0.5, 0.5],
    [3, 3],
    [300, 3],
  ])("normalizes fps %s to %s", (input, expected) => {
    useStore.getState().setFps(input);
    expect(useStore.getState().playback.fps).toBe(expected);
  });

  it("clamps negative, fractional, and invalid epoch indices", () => {
    useStore.getState().setEpochIndex(-4);
    expect(useStore.getState().playback.epochIndex).toBe(0);

    useStore.getState().setEpochIndex(4.8);
    expect(useStore.getState().playback.epochIndex).toBe(4);

    useStore.getState().setEpochIndex(Number.NaN);
    expect(useStore.getState().playback.epochIndex).toBe(0);
  });

  it.each([0, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "handles a non-playable frame count of %s",
    (count) => {
      useStore.getState().setEpochIndex(5);
      useStore.getState().setPlaying(true);
      useStore.getState().stepEpoch(1, count);
      expect(useStore.getState().playback.epochIndex).toBe(0);
      expect(useStore.getState().playback.isPlaying).toBe(false);
    },
  );

  it("clamps stepping to the sequence boundaries", () => {
    useStore.getState().stepEpoch(100, 10);
    expect(useStore.getState().playback.epochIndex).toBe(9);

    useStore.getState().stepEpoch(-100, 10);
    expect(useStore.getState().playback.epochIndex).toBe(0);
  });

  it("does not propagate a non-finite step", () => {
    useStore.getState().setEpochIndex(2);
    useStore.getState().stepEpoch(Number.NaN, 10);
    expect(useStore.getState().playback.epochIndex).toBe(2);
  });

  it("pauses when changing views", () => {
    useStore.getState().setPlaying(true);
    useStore.getState().setViewMode("3d_cube");
    expect(useStore.getState().playback.isPlaying).toBe(false);
  });

  it("pauses an archive failure without substituting synthetic data", () => {
    useStore.getState().setActiveSource("qr3");
    useStore.getState().setPlaying(true);
    useStore.getState().setStatus("error", "Archive unavailable");

    expect(useStore.getState().activeSource).toBe("qr3");
    expect(useStore.getState().playback.isPlaying).toBe(false);
    expect(useStore.getState().errorMessage).toBe("Archive unavailable");
  });

  it("fully resets source, display, drawers, and playback", () => {
    const state = useStore.getState();
    state.setActiveSource("mast");
    state.setViewMode("3d_sphere");
    state.toggleSED();
    state.toggleMeta();
    state.setCDSOverlay("gaia_dr3");
    state.setFps(3);
    state.setPlaying(true);
    state.reset();

    const reset = useStore.getState();
    expect(reset.activeSource).toBe("synthetic");
    expect(reset.viewMode).toBe("2d");
    expect(reset.sedOpen).toBe(false);
    expect(reset.metaOpen).toBe(false);
    expect(reset.displaySettings.cdsOverlay).toBe("none");
    expect(reset.playback.isPlaying).toBe(false);
    expect(reset.playback.fps).toBe(0.5);
  });
});

describe("M7 deep-link validation", () => {
  it("round-trips the complete share contract", () => {
    const state: DeepLinkState = {
      ra: 133.7951,
      dec: -7.2451,
      fov: 0.25,
      source: "qr3",
      epoch: 12,
      embed: true,
    };

    const link = createDeepLink("https://example.org/view", state);
    const parsed = parseDeepLink(new URL(link).search, defaults);

    expect(parsed).toEqual({ ok: true, state });
  });

  it.each([
    "?ra=",
    "?ra=360",
    "?ra=-1",
    "?ra=Infinity",
    "?ra=0x10",
    "?ra=1&ra=2",
    "?dec=91",
    "?fov=0",
    "?fov=5.1",
    "?source=unknown",
    "?epoch=-1",
    "?epoch=1.5",
    "?epoch=9007199254740992",
    "?embed=yes",
  ])("rejects invalid state: %s", (search) => {
    const parsed = parseDeepLink(search, defaults);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("accepts coordinate boundaries without transforming coordinates", () => {
    const parsed = parseDeepLink("?ra=0&dec=-90", defaults);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.ra).toBe(0);
      expect(parsed.state.dec).toBe(-90);
    }
  });

  it("does not interpret autoplay parameters", () => {
    const parsed = parseDeepLink(
      "?source=qr3&autoplay=true&isPlaying=true&fps=200",
      defaults,
    );

    expect(parsed.ok).toBe(true);
    expect(useStore.getState().playback.isPlaying).toBe(false);
    expect(useStore.getState().playback.fps).toBe(0.5);
  });

  it("removes playback parameters from exported links", () => {
    const link = new URL(
      createDeepLink(
        "https://example.org/?autoplay=true&fps=100&isPlaying=true",
        defaults,
      ),
    );

    expect(link.searchParams.has("autoplay")).toBe(false);
    expect(link.searchParams.has("fps")).toBe(false);
    expect(link.searchParams.has("isPlaying")).toBe(false);
  });

  it("rejects invalid export state rather than silently correcting it", () => {
    expect(() =>
      createDeepLink("https://example.org/", {
        ...defaults,
        source: "unknown" as DeepLinkState["source"],
      }),
    ).toThrow("Source must");
  });
});