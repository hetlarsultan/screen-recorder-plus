// Client-side performance metrics store. In-memory + broadcast via CustomEvent.
export type PerfEntry = {
  id: string;
  category: string; // e.g. "video-capture", "editor"
  step: string; // e.g. "scan", "capture", "seek"
  ms: number;
  ts: number;
  meta?: Record<string, string | number>;
};

const KEY = "__perf_metrics__";
const MAX = 500;

function load(): PerfEntry[] {
  if (typeof window === "undefined") return [];
  const w = window as any;
  if (!w[KEY]) w[KEY] = [];
  return w[KEY] as PerfEntry[];
}

export function recordPerf(entry: Omit<PerfEntry, "id" | "ts">) {
  if (typeof window === "undefined") return;
  const list = load();
  const e: PerfEntry = { ...entry, id: crypto.randomUUID(), ts: Date.now() };
  list.unshift(e);
  if (list.length > MAX) list.length = MAX;
  window.dispatchEvent(new CustomEvent("perf:update"));
}

export function readPerf(): PerfEntry[] {
  return load().slice();
}

export function clearPerf() {
  if (typeof window === "undefined") return;
  (window as any)[KEY] = [];
  window.dispatchEvent(new CustomEvent("perf:update"));
}

export async function timed<T>(
  category: string,
  step: string,
  fn: () => Promise<T> | T,
  meta?: Record<string, string | number>,
): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    recordPerf({ category, step, ms: performance.now() - t0, meta });
  }
}