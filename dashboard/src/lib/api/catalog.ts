import { pbFetch } from "./client";
import type {
  CatalogIdleTimeout,
  CatalogMachineType,
  CatalogPlan,
  CatalogPreset,
  CatalogRegion,
} from "./types";

export function listCatalogPlans(): Promise<CatalogPlan[]> {
  return pbFetch<CatalogPlan[]>("/api/catalog/plans");
}

export function listCatalogMachineTypes(): Promise<CatalogMachineType[]> {
  return pbFetch<CatalogMachineType[]>("/api/catalog/machine-types");
}

export function listCatalogPresets(): Promise<CatalogPreset[]> {
  return pbFetch<CatalogPreset[]>("/api/catalog/presets");
}

export function listCatalogIdleTimeouts(): Promise<CatalogIdleTimeout[]> {
  return pbFetch<CatalogIdleTimeout[]>("/api/catalog/idle-timeouts");
}

export function listCatalogRegions(): Promise<CatalogRegion[]> {
  return pbFetch<CatalogRegion[]>("/api/catalog/regions");
}
