import TopBar from "../components/TopBar/TopBar";
export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-4">
        <h1 className="text-3xl font-bold text-[var(--ol-accent)]">Privacy Policy</h1>
        <p className="text-[var(--ol-muted)] text-sm">Last updated: November 2026</p>
        <p className="text-[var(--ol-muted)]">
          ORBIT-LENS does not collect personal data. Sky coordinate queries may be 
          forwarded to IRSA/NASA APIs as described in the Methodology page. 
          No cookies, analytics, or tracking are used.
        </p>
      </main>
    </div>
  );
}

