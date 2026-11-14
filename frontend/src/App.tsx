import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Landing from "./pages/Landing";
import Explore from "./pages/Explore";
import About from "./pages/About";
import Methodology from "./pages/Methodology";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
// Register connectors
import "./connectors/qr3";
import "./connectors/synthetic";
import "./connectors/wiseview";
import "./connectors/gaia";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<Landing />} />
          <Route path="/explore"     element={<Explore />} />
          <Route path="/demo"        element={<Explore defaultSource="synthetic" />} />
          <Route path="/about"       element={<About />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/terms"       element={<Terms />} />
          <Route path="/privacy"     element={<Privacy />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

