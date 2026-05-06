import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback } from "react";
import { Upload, Sparkles, Download, Loader2, Wand2, RotateCcw } from "lucide-react";
import { editImage } from "@/utils/edit.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

const PRESETS = [
  { label: "إزالة الخلفية", prompt: "Remove the background completely, keep only the main subject on transparent background" },
  { label: "تحسين الجودة", prompt: "Enhance image quality, sharpen details, improve lighting and colors, professional photography look" },
  { label: "تأثير سينمائي", prompt: "Apply cinematic color grading, dramatic lighting, film-like atmosphere" },
  { label: "رسم زيتي", prompt: "Transform into a beautiful oil painting with visible brush strokes" },
  { label: "أبيض وأسود", prompt: "Convert to elegant black and white photograph with rich contrast" },
  { label: "خلفية استوديو", prompt: "Replace background with a clean professional studio backdrop" },
  { label: "تأثير أنمي", prompt: "Transform into anime/manga art style" },
  { label: "إضاءة ذهبية", prompt: "Add warm golden hour lighting and sun flares" },
];

function Index() {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOriginal(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(f);
  };

  const run = useCallback(async (p: string) => {
    if (!original || !p.trim()) return;
    setLoading(true);
    try {
      const r = await editImage({ data: { imageDataUrl: original, prompt: p } });
      setResult(r.image);
      setSliderPos(50);
      toast.success("تم التعديل بنجاح");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, [original]);

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `edited-${Date.now()}.png`;
    a.click();
  };

  const reset = () => {
    setOriginal(null);
    setResult(null);
    setPrompt("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/70">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold">محرر الصور AI</h1>
          </div>
          {original && (
            <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RotateCcw className="w-4 h-4" /> صورة جديدة
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {!original ? (
          <section className="text-center space-y-6 py-12">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight">
              عدّل صورك بسحر <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>الذكاء الاصطناعي</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              اختر تأثيراً جاهزاً أو اكتب وصفاً بكلماتك الخاصة، وسنعدّل صورتك في ثوانٍ
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="cursor-pointer mx-auto max-w-xl border-2 border-dashed border-border rounded-3xl p-12 hover:border-primary transition-colors"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-semibold">اضغط أو اسحب صورة هنا</p>
              <p className="text-sm text-muted-foreground mt-1">PNG, JPG, WEBP</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </section>
        ) : (
          <section className="space-y-6">
            {/* Compare slider */}
            <div className="relative mx-auto max-w-2xl rounded-2xl overflow-hidden border border-border bg-secondary/30 select-none"
              style={{ aspectRatio: "1 / 1" }}>
              <img src={original} alt="الأصلية" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
              {result && (
                <>
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                    <img src={result} alt="المعدّلة" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                  </div>
                  <input
                    type="range" min={0} max={100} value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${sliderPos}%` }}>
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <div className="text-xs">⇄</div>
                    </div>
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded">قبل</span>
                  <span className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">بعد</span>
                </>
              )}
              {loading && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center flex-col gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm">جاري المعالجة بالذكاء الاصطناعي...</p>
                </div>
              )}
            </div>

            {/* Custom prompt */}
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 bg-secondary rounded-2xl p-2 border border-border">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim()) run(prompt); }}
                  placeholder="اكتب ما تريد تعديله... مثلاً: غيّر الخلفية إلى شاطئ"
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none px-3 text-sm"
                />
                <button
                  onClick={() => run(prompt)}
                  disabled={loading || !prompt.trim()}
                  className="px-4 py-2 rounded-xl text-primary-foreground font-medium disabled:opacity-50 flex items-center gap-1 text-sm"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  <Wand2 className="w-4 h-4" /> تنفيذ
                </button>
              </div>
            </div>

            {/* Presets */}
            <div>
              <p className="text-sm text-muted-foreground mb-3 text-center">أو اختر تأثيراً جاهزاً</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => run(p.prompt)}
                    disabled={loading}
                    className="px-4 py-2 rounded-full bg-secondary border border-border text-sm hover:border-primary hover:bg-secondary/70 transition disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {result && !loading && (
              <div className="flex justify-center">
                <button
                  onClick={download}
                  className="px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold flex items-center gap-2 hover:opacity-90"
                >
                  <Download className="w-4 h-4" /> حفظ النسخة
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
