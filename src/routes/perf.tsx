import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { readPerf, clearPerf, type PerfEntry } from "@/lib/perf-metrics";
import { Activity, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/perf")({
  head: () => ({
    meta: [
      { title: "مؤشرات الأداء — محرر الصور AI" },
      { name: "description", content: "راقب زمن كل خطوة وFPS أثناء التقاط ومعالجة الإطارات." },
      { property: "og:title", content: "مؤشرات الأداء" },
      { property: "og:description", content: "زمن كل خطوة وFPS للجلسة الحالية." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PerfPage,
});

function PerfPage() {
  const [entries, setEntries] = useState<PerfEntry[]>([]);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const refresh = () => setEntries(readPerf());
    refresh();
    window.addEventListener("perf:update", refresh);
    return () => window.removeEventListener("perf:update", refresh);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const tick = (t: number) => {
      frames++;
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, { count: number; total: number; last: number; min: number; max: number }>();
    for (const e of entries) {
      const key = `${e.category} · ${e.step}`;
      const g = map.get(key) ?? { count: 0, total: 0, last: e.ms, min: Infinity, max: 0 };
      g.count++;
      g.total += e.ms;
      g.last = e.ms;
      g.min = Math.min(g.min, e.ms);
      g.max = Math.max(g.max, e.ms);
      map.set(key, g);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [entries]);

  const captureFps = useMemo(() => {
    const seeks = entries.filter((e) => e.category === "video-capture" && (e.step === "seek" || e.step === "sample"));
    if (seeks.length < 2) return 0;
    const recent = seeks.slice(0, 30);
    const avg = recent.reduce((s, e) => s + e.ms, 0) / recent.length;
    return avg > 0 ? Math.round(1000 / avg) : 0;
  }, [entries]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-10 bg-background/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold">مؤشرات الأداء</h1>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> رجوع
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="FPS (واجهة المستخدم)" value={`${fps}`} hint="أعلى = أنعم" />
          <Stat label="FPS التقاط الفيديو" value={`${captureFps}`} hint="متوسط آخر 30 عيّنة" />
          <Stat label="عدد الخطوات" value={`${entries.length}`} hint="مسجّلة في الجلسة" />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">تجميع حسب الخطوة</h2>
          <button onClick={clearPerf} className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> مسح
          </button>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs text-muted-foreground">
                <th className="text-start px-3 py-2">الخطوة</th>
                <th className="px-3 py-2">العدد</th>
                <th className="px-3 py-2">الإجمالي</th>
                <th className="px-3 py-2">المتوسط</th>
                <th className="px-3 py-2">أدنى</th>
                <th className="px-3 py-2">أقصى</th>
                <th className="px-3 py-2">آخر</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-6">لا توجد بيانات بعد. شغّل الالتقاط أو المعالجة لتظهر هنا.</td></tr>
              ) : groups.map(([k, g]) => (
                <tr key={k} className="border-t border-border">
                  <td className="px-3 py-2 text-start">{k}</td>
                  <td className="px-3 py-2 text-center">{g.count}</td>
                  <td className="px-3 py-2 text-center">{g.total.toFixed(0)}ms</td>
                  <td className="px-3 py-2 text-center">{(g.total / g.count).toFixed(1)}ms</td>
                  <td className="px-3 py-2 text-center">{g.min.toFixed(1)}ms</td>
                  <td className="px-3 py-2 text-center">{g.max.toFixed(1)}ms</td>
                  <td className="px-3 py-2 text-center">{g.last.toFixed(1)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="font-semibold mb-2">آخر 50 حدث</h2>
          <div className="rounded-2xl border border-border divide-y divide-border max-h-96 overflow-auto">
            {entries.slice(0, 50).map((e) => (
              <div key={e.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                <span className="text-muted-foreground shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="flex-1 truncate">{e.category} · {e.step}{e.meta ? ` · ${Object.entries(e.meta).map(([k, v]) => `${k}=${v}`).join(", ")}` : ""}</span>
                <span className="font-mono">{e.ms.toFixed(1)}ms</span>
              </div>
            ))}
            {entries.length === 0 && <div className="px-3 py-6 text-center text-muted-foreground text-sm">فارغ</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}