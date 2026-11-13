import type {
  SearchQuery,
  SearchResult,
  ObservationRecord,
  QualityReport,
  CompareResult,
  TileQuery,
  TileResponse,
  TimeCubeMetadata,
  CubeAxis,
} from "../types/cids";

/** All backend connectors must implement this interface */
export interface IConnector {
  readonly id: string;
  readonly label: string;
  search(query: SearchQuery): Promise<SearchResult>;
  fetchCutout(recordId: string, ra: number, dec: number, band: string): Promise<ObservationRecord>;
  fetchSpectrum(recordId: string): Promise<{ wavelengths: number[]; flux: number[]; variance: number[] }>;
  fetchQuality(recordId: string): Promise<QualityReport>;
  compare(recordIds: string[]): Promise<CompareResult>;
  fetchTiles(query: TileQuery): Promise<TileResponse>;
  fetchCube(recordId: string, axis: CubeAxis): Promise<TimeCubeMetadata>;
}

/** Connector registry */
const registry = new Map<string, IConnector>();

export function registerConnector(c: IConnector) {
  registry.set(c.id, c);
}

export function getConnector(id: string): IConnector {
  const c = registry.get(id);
  if (!c) throw new Error(`Connector "${id}" not registered`);
  return c;
}

export function listConnectors(): IConnector[] {
  return Array.from(registry.values());
}
