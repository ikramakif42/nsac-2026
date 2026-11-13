import { Link } from "react-router-dom";
import TopBar from "../components/TopBar/TopBar";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold text-[var(--ol-accent)]">About ORBIT-LENS</h1>
        <p className="text-[var(--ol-muted)]">
          ORBIT-LENS is a web application for exploring time-domain infrared sky data from 
          SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization, 
          and Ices Explorer), NASA's all-sky spectral survey mission.
        </p>
        <p className="text-[var(--ol-muted)]">
          Built for the 2026 NASA Space Apps Challenge — Planet X and SPHEREx challenge.
        </p>
        <div className="p-4 rounded-lg border border-[var(--ol-border)] bg-[var(--ol-surface)] text-sm text-[var(--ol-muted)]">
          <strong className="text-[var(--ol-warning)]">⚠ Disclaimer:</strong> ORBIT-LENS is an 
          independent project by Team Schwarzschildren. It is not affiliated with or endorsed 
          by NASA, JPL, or the SPHEREx mission. All data sourced from publicly available 
          NASA/IRSA archives.
        </div>
        <nav className="flex gap-4 text-sm">
          <Link to="/methodology" className="text-[var(--ol-accent)] hover:underline">Methodology →</Link>
          <Link to="/explore" className="text-[var(--ol-accent)] hover:underline">Open Explorer →</Link>
        </nav>
      </main>
    </div>
  );
}

