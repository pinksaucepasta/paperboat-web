/**
 * Static fixtures for the sample console. Shaped like what a real edge/infra
 * API would return so components can be swapped onto live data unchanged.
 */

export type DeployState = "ready" | "building" | "error" | "queued" | "canceled";

export type Deployment = {
  id: string;
  project: string;
  branch: string;
  commit: string;
  message: string;
  author: { name: string; initials: string };
  state: DeployState;
  environment: "production" | "preview";
  durationSec: number;
  createdAt: string;
};

export type Incident = {
  id: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  region: string;
  openedAt: string;
};

export type Region = {
  code: string;
  city: string;
  p99Ms: number;
  sharePct: number;
};

/* --- KPI series -------------------------------------------------------- */

/** 30 days of requests (millions), gently trending up with weekly dips. */
export const requestSeries: number[] = [
  18.2, 19.1, 17.4, 12.6, 11.9, 19.8, 20.4, 21.1, 20.2, 14.1, 13.2, 22.0, 22.9,
  23.4, 22.1, 15.6, 14.8, 24.2, 25.1, 24.6, 25.9, 17.2, 16.4, 26.8, 27.6, 28.1,
  27.2, 18.9, 18.1, 29.4,
];

/** Matching p99 latency (ms) — inversely textured against traffic. */
export const latencySeries: number[] = [
  142, 138, 145, 121, 118, 149, 152, 156, 151, 126, 122, 158, 162, 165, 159,
  131, 128, 168, 172, 169, 175, 134, 130, 178, 181, 184, 179, 138, 135, 186,
];

export const errorSeries: number[] = [
  0.42, 0.38, 0.51, 0.29, 0.24, 0.46, 0.52, 0.61, 0.48, 0.31, 0.27, 0.55, 0.68,
  1.42, 0.94, 0.36, 0.3, 0.58, 0.63, 0.59, 0.71, 0.33, 0.28, 0.66, 0.72, 0.79,
  0.68, 0.35, 0.29, 0.44,
];

export const buildSeries: number[] = [
  62, 58, 71, 44, 39, 66, 74, 81, 69, 47, 42, 77, 84, 88, 79, 51, 46, 86, 92,
  89, 96, 54, 49, 94, 99, 104, 97, 58, 52, 108,
];

export type Kpi = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  deltaPct: number;
  /** Whether a rising number is good. Error rate rising is bad. */
  higherIsBetter: boolean;
  series: number[];
  caption: string;
};

export const kpis: Kpi[] = [
  {
    key: "requests",
    label: "Edge requests",
    value: "29.4",
    unit: "M",
    deltaPct: 12.4,
    higherIsBetter: true,
    series: requestSeries,
    caption: "vs. 26.2M previous 30d",
  },
  {
    key: "latency",
    label: "p99 latency",
    value: "186",
    unit: "ms",
    deltaPct: 6.9,
    higherIsBetter: false,
    series: latencySeries,
    caption: "vs. 174ms previous 30d",
  },
  {
    key: "errors",
    label: "Error rate",
    value: "0.44",
    unit: "%",
    deltaPct: -18.5,
    higherIsBetter: false,
    series: errorSeries,
    caption: "vs. 0.54% previous 30d",
  },
  {
    key: "builds",
    label: "Builds shipped",
    value: "108",
    deltaPct: 21.3,
    higherIsBetter: true,
    series: buildSeries,
    caption: "vs. 89 previous 30d",
  },
];

/* --- Deployments -------------------------------------------------------- */

export const deployments: Deployment[] = [
  {
    id: "dpl_8Kq2mN",
    project: "paperboat-web",
    branch: "main",
    commit: "a3f9c21",
    message: "feat(hero): ship dither scrim at lg breakpoint",
    author: { name: "Anvit Dadape", initials: "AD" },
    state: "ready",
    environment: "production",
    durationSec: 47,
    createdAt: "2026-07-17T14:22:00Z",
  },
  {
    id: "dpl_7Jp1lM",
    project: "paperboat-api",
    branch: "fix/rate-limit-window",
    commit: "b7d4e08",
    message: "fix: sliding window off-by-one on burst refill",
    author: { name: "Rhea Kapoor", initials: "RK" },
    state: "building",
    environment: "preview",
    durationSec: 31,
    createdAt: "2026-07-17T14:09:00Z",
  },
  {
    id: "dpl_6Hn0kL",
    project: "paperboat-docs",
    branch: "main",
    commit: "c1a8f93",
    message: "docs: token reference for --ease-physical",
    author: { name: "Sam Oyelaran", initials: "SO" },
    state: "ready",
    environment: "production",
    durationSec: 22,
    createdAt: "2026-07-17T13:41:00Z",
  },
  {
    id: "dpl_5Gm9jK",
    project: "paperboat-api",
    branch: "chore/base-ui-bump",
    commit: "d9e2b47",
    message: "chore: bump @base-ui/react to 1.6.0",
    author: { name: "Lena Vogt", initials: "LV" },
    state: "error",
    environment: "preview",
    durationSec: 118,
    createdAt: "2026-07-17T12:58:00Z",
  },
  {
    id: "dpl_4Fl8iJ",
    project: "paperboat-web",
    branch: "feat/usage-meter",
    commit: "e4c7a12",
    message: "feat(billing): usage meter with soft cap warning",
    author: { name: "Rhea Kapoor", initials: "RK" },
    state: "ready",
    environment: "preview",
    durationSec: 53,
    createdAt: "2026-07-17T11:30:00Z",
  },
  {
    id: "dpl_3Ek7hI",
    project: "paperboat-edge",
    branch: "main",
    commit: "f8b3d65",
    message: "perf: cache compiled routes across isolates",
    author: { name: "Anvit Dadape", initials: "AD" },
    state: "ready",
    environment: "production",
    durationSec: 39,
    createdAt: "2026-07-17T10:14:00Z",
  },
  {
    id: "dpl_2Dj6gH",
    project: "paperboat-edge",
    branch: "spike/wasm-router",
    commit: "0a5f1c9",
    message: "spike: wasm router prototype behind flag",
    author: { name: "Sam Oyelaran", initials: "SO" },
    state: "canceled",
    environment: "preview",
    durationSec: 12,
    createdAt: "2026-07-17T09:02:00Z",
  },
  {
    id: "dpl_1Ci5fG",
    project: "paperboat-docs",
    branch: "content/changelog-jul",
    commit: "1b6e2d4",
    message: "content: July changelog entries",
    author: { name: "Lena Vogt", initials: "LV" },
    state: "queued",
    environment: "preview",
    durationSec: 0,
    createdAt: "2026-07-17T08:47:00Z",
  },
];

/* --- Incidents ---------------------------------------------------------- */

export const incidents: Incident[] = [
  {
    id: "inc_204",
    title: "Elevated 5xx on iad1 origin shield",
    severity: "sev2",
    status: "monitoring",
    region: "iad1",
    openedAt: "2026-07-17T13:12:00Z",
  },
  {
    id: "inc_203",
    title: "Build queue backpressure after runner scale-in",
    severity: "sev3",
    status: "identified",
    region: "global",
    openedAt: "2026-07-17T09:40:00Z",
  },
  {
    id: "inc_202",
    title: "Stale cache served in fra1 after purge",
    severity: "sev3",
    status: "resolved",
    region: "fra1",
    openedAt: "2026-07-16T21:05:00Z",
  },
];

/* --- Regions ------------------------------------------------------------ */

export const regions: Region[] = [
  { code: "iad1", city: "Washington, D.C.", p99Ms: 186, sharePct: 34 },
  { code: "sfo1", city: "San Francisco", p99Ms: 142, sharePct: 24 },
  { code: "fra1", city: "Frankfurt", p99Ms: 168, sharePct: 19 },
  { code: "bom1", city: "Mumbai", p99Ms: 214, sharePct: 14 },
  { code: "syd1", city: "Sydney", p99Ms: 238, sharePct: 9 },
];

export const projects = [
  { name: "paperboat-web", framework: "Next.js" },
  { name: "paperboat-api", framework: "Hono" },
  { name: "paperboat-edge", framework: "Workers" },
  { name: "paperboat-docs", framework: "Astro" },
];

/* --- Helpers ------------------------------------------------------------ */

export function relativeTime(iso: string, now = new Date("2026-07-17T14:30:00Z")) {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatDuration(sec: number) {
  if (sec === 0) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
