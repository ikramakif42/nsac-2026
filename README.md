# ORBIT-LENS

> **NASA Space Apps Challenge 2026** — *Planet X and SPHEREx*  
> Developed by Team Schwarzschildren

ORBIT-LENS is an interactive multi-epoch infrared sky viewer and spectral analysis tool designed for NASA's SPHEREx mission data releases (QR3 and beyond). It enables astronomers, researchers, and citizen scientists to explore time-domain variability, inspect 102-band spectral energy distributions (SEDs), and analyze celestial targets through a decoupled Cross-modal Interoperability Data Schema (CIDS).

---

## ⚠️ Mission Disclaimer
*ORBIT-LENS is an independent open-source project created by Team Schwarzschildren for the 2026 NASA Space Apps Challenge. It is not affiliated with, sponsored by, or endorsed by NASA, the Jet Propulsion Laboratory (JPL), or the SPHEREx mission team. All astronomical data is sourced from publicly available archives hosted by NASA/IPAC Infrared Science Archive (IRSA), ESA Gaia, and CDS/VizieR.*

---

## Architecture Overview

- **Frontend**: React 19, TypeScript, Vite 6, Zustand, Tailwind CSS, WebGL 2.0 (2D primary viewer), Three.js / React Three Fiber (lazy-loaded 3D modes), uPlot (SED drawer).
- **Backend**: Python 3.12, FastAPI, Astropy (MEF FITS parsing, WCS transformations), NumPy, PyVO (IRSA SIA v2 / TAP / IBE connectors).
- **Contract**: Cross-modal Interoperability Data Schema (CIDS) ensuring clean separation between frontend presentation and backend astronomical science computations.

---

## Getting Started

### Prerequisites
- Node.js >= 20.x and npm >= 10.x
- Python 3.12 (64-bit)

### Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Backend API will be accessible at: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend development server will run at: `http://localhost:5173`

---

## License
Open source under the [Apache-2.0 License](LICENSE).

