import type { ObservationRecord } from "../../types/cids";
import Scientific3DViewer from "./Scientific3DViewer";

interface Props {
  records: ObservationRecord[];
}

export default function CubeViewer({ records }: Props) {
  return <Scientific3DViewer records={records} mode="cube" />;
}