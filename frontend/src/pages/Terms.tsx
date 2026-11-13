import TopBar from "../components/TopBar/TopBar";
export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-4">
        <h1 className="text-3xl font-bold text-[var(--ol-accent)]">Terms of Use</h1>
        <p className="text-[var(--ol-muted)] text-sm">Last updated: November 2026</p>
        <p className="text-[var(--ol-muted)]">
          ORBIT-LENS is provided as-is for educational and research purposes as part of 
          the 2026 NASA Space Apps Challenge. No warranty is expressed or implied. 
          All NASA data used under NASA's open data policy.
        </p>
        <p className="text-[var(--ol-muted)]">
          This project is not affiliated with NASA. The NASA name and logo are not used 
          as endorsements. All trademarks belong to their respective owners.
        </p>
      </main>
    </div>
  );
}

