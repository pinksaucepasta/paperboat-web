import { pbFetch } from "./client";
import type {
  CatalogIdleTimeout,
  CatalogMachineType,
  CatalogPlan,
  CatalogPreset,
  CatalogRegion,
} from "./types";

export function listCatalogPlans(): Promise<CatalogPlan[]> {
  return pbFetch<CatalogPlan[]>("/v1/catalog/plans");
}

export function listCatalogMachineTypes(): Promise<CatalogMachineType[]> {
  return pbFetch<CatalogMachineType[]>("/v1/catalog/machine-types");
}

export function listCatalogPresets(): Promise<CatalogPreset[]> {
  return pbFetch<CatalogPreset[]>("/v1/catalog/presets");
}

export function listCatalogIdleTimeouts(): Promise<CatalogIdleTimeout[]> {
  return pbFetch<CatalogIdleTimeout[]>("/v1/catalog/idle-timeouts");
}

export function listCatalogRegions(): Promise<CatalogRegion[]> {
  return pbFetch<CatalogRegion[]>("/v1/catalog/regions");
}
