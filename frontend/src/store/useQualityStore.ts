import { create } from "zustand";
import type { QualityLoadStatus, QualityProducts } from "../types/quality";

interface QualityState {
  key: string | null;
  revision: number;
  retryRevision: number;
  status: QualityLoadStatus;
  products: QualityProducts | null;
  error: string | null;
  begin: (key: string) => number;
  resolve: (
    key: string,
    revision: number,
    products: QualityProducts,
  ) => boolean;
  reject: (key: string, revision: number, error: string) => void;
  clear: () => void;
  retry: () => void;
}

export const useQualityStore = create<QualityState>((set) => ({
  key: null,
  revision: 0,
  retryRevision: 0,
  status: "idle",
  products: null,
  error: null,

  begin: (key) => {
    let revision = 0;
    set((state) => {
      revision = state.revision + 1;
      return {
        key,
        revision,
        status: "loading",
        products: null,
        error: null,
      };
    });
    return revision;
  },

  resolve: (key, revision, products) => {
    let accepted = false;
    set((state) => {
      if (state.key !== key || state.revision !== revision) return state;
      accepted = true;
      return { status: "ready", products, error: null };
    });
    return accepted;
  },

  reject: (key, revision, error) => {
    set((state) => {
      if (state.key !== key || state.revision !== revision) return state;
      return { status: "error", products: null, error };
    });
  },

  clear: () => {
    set((state) => ({
      key: null,
      revision: state.revision + 1,
      status: "idle",
      products: null,
      error: null,
    }));
  },

  retry: () => {
    set((state) => ({ retryRevision: state.retryRevision + 1 }));
  },
}));