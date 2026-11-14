import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ArrayId, SpectrumResponse } from "../../types/cids";
import { FEATURES, visibleFlux } from "./spectrum";

interface Props {
  spectrum: SpectrumResponse;
  enabled: ReadonlySet<ArrayId>;
  showFeatures: boolean;
  showErrors: boolean;
}

export default function SEDChart({
  spectrum,
  enabled,
  showFeatures,
  showErrors,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    setSelected(null);
    setChartError(null);
    const flux = visibleFlux(spectrum, enabled);
    const data: uPlot.AlignedData = [spectrum.wavelengths, flux];

    let plot: uPlot;
    try {
      plot = new uPlot(
        {
          width: Math.max(280, element.clientWidth),
          height: 260,
          scales: {
            x: { time: false },
            y: { auto: true },
          },
          axes: [
            {
              label: "Wavelength (μm)",
              stroke: "#cbd5e1",
              grid: { stroke: "#334155" },
              values: (_plot, ticks) => ticks.map((value) => value.toFixed(2)),
            },
            {
              label: "Flux (backend units)",
              stroke: "#cbd5e1",
              grid: { stroke: "#334155" },
              size: 88,
              values: (_plot, ticks) =>
                ticks.map((value) => value.toExponential(1)),
            },
          ],
          series: [
            { label: "Wavelength (μm)" },
            {
              label: "Flux",
              stroke: "#67e8f9",
              width: 1.5,
              spanGaps: false,
              points: { show: true, size: 4 },
            },
          ],
          legend: { show: false },
          cursor: { drag: { x: true, y: false } },
          hooks: {
            setCursor: [
              (chart) => setSelected(chart.cursor.idx ?? null),
            ],
            draw: [
              (chart) => {
                const context = chart.ctx;
                const { left, top, width, height } = chart.bbox;
                context.save();
                context.beginPath();
                context.rect(left, top, width, height);
                context.clip();

                if (showErrors) {
                  context.strokeStyle = "#94a3b8";
                  context.lineWidth = 1;
                  context.setLineDash([]);
                  context.beginPath();
                  spectrum.wavelengths.forEach((wavelength, index) => {
                    if (flux[index] === null) return;
                    // Rendering ±1σ from backend variance; no SNR or fitting.
                    const sigma = Math.sqrt(spectrum.variance[index]);
                    const x = chart.valToPos(wavelength, "x", true);
                    const upper = chart.valToPos(
                      spectrum.flux[index] + sigma, "y", true,
                    );
                    const lower = chart.valToPos(
                      spectrum.flux[index] - sigma, "y", true,
                    );
                    context.moveTo(x, upper);
                    context.lineTo(x, lower);
                    context.moveTo(x - 3, upper);
                    context.lineTo(x + 3, upper);
                    context.moveTo(x - 3, lower);
                    context.lineTo(x + 3, lower);
                  });
                  context.stroke();
                }

                if (showFeatures) {
                  for (const feature of FEATURES) {
                    const x = chart.valToPos(feature.wavelength, "x", true);
                    context.strokeStyle = feature.color;
                    context.setLineDash([5, 5]);
                    context.beginPath();
                    context.moveTo(x, top);
                    context.lineTo(x, top + height);
                    context.stroke();
                  }
                }
                context.restore();
              },
            ],
          },
        },
        data,
        element,
      );
    } catch (error) {
      element.replaceChildren();
      setChartError(
        error instanceof Error ? error.message : "Chart rendering failed",
      );
      return;
    }

    plotRef.current = plot;
    const resize = () => {
      const width = element.clientWidth;
      if (width > 0) plot.setSize({ width: Math.max(280, width), height: 260 });
    };
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resize);
    observer?.observe(element);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      plotRef.current = null;
      plot.destroy();
    };
  }, [spectrum, enabled, showFeatures, showErrors]);

  return (
    <div>
      <div className="ol-sed-chart" ref={host} aria-hidden="true" />
      {chartError && (
        <p role="alert">
          Chart unavailable: {chartError}. The data table remains available.
        </p>
      )}
      <div className="ol-sed-chart-actions">
        <button
          type="button"
          onClick={() => {
            const plot = plotRef.current;
            const wavelengths = spectrum.wavelengths;
            if (plot && wavelengths.length > 1) {
              plot.setScale("x", {
                min: wavelengths[0],
                max: wavelengths[wavelengths.length - 1],
              });
            }
          }}
        >
          Reset zoom
        </button>
        <span>Drag horizontally to zoom. Use the table for keyboard access.</span>
      </div>
      <p className="ol-sed-readout">
        {selected !== null && spectrum.wavelengths[selected] !== undefined
          ? `${spectrum.wavelengths[selected].toFixed(4)} μm · flux ${
              spectrum.flux[selected].toExponential(5)
            } · variance ${spectrum.variance[selected].toExponential(5)}`
          : "Point to a channel to inspect its backend measurements."}
      </p>
    </div>
  );
}