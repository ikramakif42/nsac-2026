import TopBar from "../components/TopBar/TopBar";

export default function Methodology() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold text-[var(--ol-accent)]">Methodology</h1>

        <Section title="Data Pipeline">
          <p>All data fetched from IRSA via SIA v2 / IBE APIs. FITS files are parsed 
          server-side using Astropy. The 3-HDU Level 2 format provides: science pixels 
          (HDU 1), per-pixel variance (HDU 2), and quality bitmask (HDU 3).</p>
        </Section>

        <Section title="Quality Gating">
          <p>Observations are only shown when HDU 3 bitmask is 0 for science pixels (quality_ok). 
          SNR is derived from HDU 1 / √HDU 2. Quality-failed frames are flagged, never silently 
          hidden or replaced.</p>
        </Section>

        <Section title="Coordinate System">
          <p>All sky coordinates are ICRS (RA/Dec, J2000). WCS-TAN projection applied 
          using Astropy's WCS engine. Pixel-to-sky transformations are computed server-side 
          only — the frontend renders GPU pixels mapped via WCS matrices.</p>
        </Section>

        <Section title="SPHEREx LVF Wavelength Mapping">
          <p>SPHEREx uses Linear Variable Filters (LVFs). Each pixel on the detector 
          corresponds to a unique wavelength. Wavelength is modelled as a linear function 
          of detector row position, calibrated per survey release.</p>
        </Section>

        <Section title="Rendering">
          <p>Primary 2D viewer uses WebGL2 with custom GLSL shaders for colormap 
          stretching (linear, sqrt, log, asinh). Three.js (R3F) viewers for 3D 
          representations are lazy-loaded on demand. All pixel math uses Float32 precision.</p>
        </Section>

        <Section title="Open Source">
          <p>Source code licensed Apache-2.0. Data citations: SPHEREx/IRSA, 
          Gaia DR3 (ESA), 2MASS (IPAC/Caltech).</p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-[var(--ol-text)]">{title}</h2>
      <div className="text-[var(--ol-muted)] text-sm leading-relaxed">{children}</div>
    </section>
  );
}

