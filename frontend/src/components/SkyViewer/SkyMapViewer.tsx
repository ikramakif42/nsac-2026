import { useStore } from "../../store/useStore";
import type { SearchQuery } from "../../types/cids";
import WebGL2Canvas from "./WebGL2Canvas";

interface Props {
  onSearch?: (query: SearchQuery) => void;
}

/**
 * The map uses the same observation viewport and store as the 2D comparator.
 * Celestial projection is represented only by backend-prepared products.
 */
export default function SkyMapViewer(_props: Props) {
  const result = useStore((s) => s.result);
  const source = useStore((s) => s.activeSource);
  const status = useStore((s) => s.status);
  const records =
    status === "ready" && result?.source_used === source
      ? result.records
      : [];

  return <WebGL2Canvas records={records} />;
}