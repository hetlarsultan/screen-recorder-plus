import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2, Wand2, RotateCcw, Brush, Eraser, Trash2, Eye, EyeOff, Crop, Square, Wand, Maximize2, Video, Activity } from "lucide-react";
import { editImage } from "@/utils/edit.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { VideoFrameCapture } from "@/components/VideoFrameCapture";
import { recordPerf } from "@/lib/perf-metrics";

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
  const [mode, setMode] = useState<"image" | "video">("image");
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingResult, setPendingResult] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [hasMask, setHasMask] = useState(false);
  const [maskVisible, setMaskVisible] = useState(true);
  const [tool, setTool] = useState<"brush" | "rect">("brush");
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const rectEndRef = useRef<{ x: number; y: number } | null>(null);
  const [rectVersion, setRectVersion] = useState(0);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const baseMaskRef = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);

  // Initialize canvas to image natural size when original changes
  useEffect(() => {
    if (!original) return;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
      setHasMask(false);
    };
    img.src = original;
  }, [original]);

  const getCanvasPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const draw = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const { x, y } = getCanvasPos(e);
    if (tool === "brush") {
      const r = (brushSize / 100) * Math.max(c.width, c.height) / 10;
      ctx.fillStyle = "rgba(255, 40, 80, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      setHasMask(true);
    } else {
      rectEndRef.current = { x, y };
      if (baseMaskRef.current) ctx.putImageData(baseMaskRef.current, 0, 0);
      else ctx.clearRect(0, 0, c.width, c.height);
      const s = rectStartRef.current!;
      ctx.fillStyle = "rgba(255, 40, 80, 0.45)";
      ctx.fillRect(s.x, s.y, x - s.x, y - s.y);
      ctx.strokeStyle = "rgba(255, 40, 80, 0.95)";
      ctx.lineWidth = Math.max(2, c.width / 400);
      ctx.strokeRect(s.x, s.y, x - s.x, y - s.y);
      setHasMask(true);
      setRectVersion((v) => v + 1);
    }
  };

  // Live crop preview whenever rect selection changes
  useEffect(() => {
    if (tool !== "rect" || !rectStartRef.current || !rectEndRef.current || !original) {
      setCropPreview(null);
      return;
    }
    const s = rectStartRef.current, e = rectEndRef.current;
    const x = Math.min(s.x, e.x), y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x), h = Math.abs(e.y - s.y);
    if (w < 8 || h < 8) { setCropPreview(null); return; }
    const t0 = performance.now();
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      setCropPreview(c.toDataURL("image/png"));
      recordPerf({ category: "editor", step: "crop-preview", ms: performance.now() - t0, meta: { w: Math.round(w), h: Math.round(h) } });
    };
    img.src = original;
  }, [rectVersion, tool, original]);

  const clearMask = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    baseMaskRef.current = null;
    rectStartRef.current = null;
    rectEndRef.current = null;
    setHasMask(false);
    setCropPreview(null);
  };

  const buildMaskedImage = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = original!;
    });
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOriginal(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(f);
  };

  const PRESERVE = " IMPORTANT: Keep the exact same composition, camera angle, framing, perspective, lighting, colors and all unaffected areas pixel-identical to the original. Do not crop, rotate, or change the aspect ratio.";

  const run = useCallback(async (p: string) => {
    if (!original || !p.trim()) return;
    setLoading(true);
    try {
      let imageToSend = original;
      let finalPrompt = p + PRESERVE;
      if (hasMask) {
        imageToSend = await buildMaskedImage();
        finalPrompt =
          `Remove the object/area marked with the red/pink overlay in the image and seamlessly inpaint the background behind it. ${p ? "Additional instruction: " + p + ". " : ""}` +
          PRESERVE;
      }
      const t0 = performance.now();
      const r = await editImage({ data: { imageDataUrl: imageToSend, prompt: finalPrompt } });
      recordPerf({ category: "editor", step: "ai-edit", ms: performance.now() - t0, meta: { masked: hasMask ? 1 : 0 } });
      setResult(r.image);
      setSliderPos(50);
      clearMask();
      setSelectMode(false);
      toast.success("تم التعديل بنجاح");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, [original, hasMask]);

  const removeSelected = () => {
    if (!hasMask) {
      toast.error("حدد المنطقة المراد إزالتها أولاً");
      return;
    }
    run("Remove the marked object");
  };

  const fillSelected = async () => {
    if (!hasMask || !original) { toast.error("حدد المنطقة أولاً"); return; }
    setPreviewLoading(true);
    try {
      const masked = await buildMaskedImage();
      const p = prompt.trim() ? prompt : "Fill / complete the marked area naturally based on surrounding context";
      const finalPrompt =
        `Fill / complete the area marked with the red/pink overlay in the image naturally and seamlessly. ${prompt.trim() ? "Additional instruction: " + prompt + ". " : ""}` +
        PRESERVE;
      const t0 = performance.now();
      const r = await editImage({ data: { imageDataUrl: masked, prompt: finalPrompt } });
      recordPerf({ category: "editor", step: "ai-fill-preview", ms: performance.now() - t0 });
      setPendingResult(r.image);
      toast.success("معاينة جاهزة — راجع النتيجة قبل التطبيق");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setPreviewLoading(false);
    }
  };

  const acceptPending = () => {
    if (!pendingResult) return;
    setResult(pendingResult);
    setPendingResult(null);
    setSliderPos(50);
    clearMask();
    setSelectMode(false);
    toast.success("تم تطبيق النتيجة");
  };

  const rejectPending = () => {
    setPendingResult(null);
    toast("تم تجاهل المعاينة");
  };

  const outpaintImage = async (padPercent = 25) => {
    if (!original) return;
    setPreviewLoading(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = original;
      });
      const padX = Math.round((img.naturalWidth * padPercent) / 100);
      const padY = Math.round((img.naturalHeight * padPercent) / 100);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth + padX * 2;
      c.height = img.naturalHeight + padY * 2;
      const ctx = c.getContext("2d")!;
      // Neutral gray fill marks the area to extend (model will replace it)
      ctx.fillStyle = "rgb(200,200,200)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, padX, padY);
      // Subtle red border around original to mark the "keep exactly" zone
      ctx.strokeStyle = "rgba(255, 40, 80, 0.9)";
      ctx.lineWidth = Math.max(2, Math.min(c.width, c.height) / 400);
      ctx.strokeRect(padX, padY, img.naturalWidth, img.naturalHeight);
      const dataUrl = c.toDataURL("image/png");
      const finalPrompt =
        `Outpainting task: extend the image into the gray border area around the original photo. ` +
        `Continue and complete any subject (body, clothing, hair, objects) that is cut off at the edges, ` +
        `keeping the exact same clothing, style, body proportions, composition, camera angle, perspective, lighting, shadows, color palette and background style as the visible original. ` +
        `The area inside the red rectangle must remain pixel-identical to the original — do not alter, redraw, restyle, recolor, or move anything inside it. ` +
        `Only generate new content in the gray padding to seamlessly extend the scene. ` +
        `Remove the red guide rectangle in the output. Output must be photorealistic and consistent with the original.`;
      const t0 = performance.now();
      const r = await editImage({ data: { imageDataUrl: dataUrl, prompt: finalPrompt } });
      recordPerf({ category: "editor", step: "ai-outpaint", ms: performance.now() - t0, meta: { pad: padPercent } });
      setPendingResult(r.image);
      toast.success("معاينة الإكمال جاهزة — راجع قبل التطبيق");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setPreviewLoading(false);
    }
  };

  const cropSelected = () => {
    if (tool !== "rect" || !rectStartRef.current || !rectEndRef.current || !original) {
      toast.error("استخدم أداة المستطيل لتحديد منطقة الاقتصاص");
      return;
    }
    const s = rectStartRef.current, e = rectEndRef.current;
    const x = Math.min(s.x, e.x), y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x), h = Math.abs(e.y - s.y);
    if (w < 5 || h < 5) { toast.error("المنطقة صغيرة جداً"); return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
      setResult(c.toDataURL("image/png"));
      setSliderPos(50);
      clearMask();
      setSelectMode(false);
      toast.success("تم الاقتصاص");
    };
    img.src = original;
  };

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
    setSelectMode(false);
    setHasMask(false);
    setPendingResult(null);
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
          <div className="flex items-center gap-3">
            <Link to="/perf" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Activity className="w-4 h-4" /> الأداء
            </Link>
            {original && (
              <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RotateCcw className="w-4 h-4" /> صورة جديدة
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {!original ? (
          <section className="text-center space-y-6 py-12">
            {mode === "video" ? (
              <VideoFrameCapture onBack={() => setMode("image")} />
            ) : (
            <>
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

            <div className="pt-2">
              <button
                onClick={() => setMode("video")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary border border-border hover:border-primary transition text-sm font-medium"
              >
                <Video className="w-4 h-4 text-primary" /> التقاط صور من فيديو (أعلى دقة)
              </button>
            </div>
            </>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            {/* Compare slider */}
            <div className="relative mx-auto max-w-2xl rounded-2xl overflow-hidden border border-border bg-secondary/30 select-none"
              style={{ aspectRatio: "1 / 1" }}>
              <img ref={imgRef} src={original} alt="الأصلية" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
              {/* Selection canvas overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ pointerEvents: selectMode && !result ? "auto" : "none", touchAction: "none", cursor: selectMode ? "crosshair" : "default", opacity: maskVisible ? 1 : 0 }}
                onPointerDown={(e) => {
                  if (!selectMode) return;
                  (e.target as Element).setPointerCapture(e.pointerId);
                  drawingRef.current = true;
                  if (tool === "rect") {
                    const c = canvasRef.current!;
                    const ctx = c.getContext("2d")!;
                    baseMaskRef.current = ctx.getImageData(0, 0, c.width, c.height);
                    rectStartRef.current = getCanvasPos(e);
                    rectEndRef.current = getCanvasPos(e);
                  }
                  draw(e);
                }}
                onPointerMove={draw}
                onPointerUp={() => { drawingRef.current = false; }}
                onPointerLeave={() => { drawingRef.current = false; }}
              />
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
              {previewLoading && !loading && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center flex-col gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm">جاري إنشاء المعاينة...</p>
                </div>
              )}
              {pendingResult && !loading && !previewLoading && (
                <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center p-3">
                  <div className="flex flex-col items-center gap-3 max-w-full max-h-full">
                    <p className="text-sm font-medium">معاينة النتيجة</p>
                    <img src={pendingResult} alt="معاينة" className="max-w-full max-h-[60vh] object-contain rounded-xl border border-border" />
                    <div className="flex gap-2">
                      <button onClick={acceptPending} className="px-4 py-2 rounded-xl text-primary-foreground text-sm font-semibold" style={{ background: "var(--gradient-hero)" }}>
                        تطبيق
                      </button>
                      <button onClick={rejectPending} className="px-4 py-2 rounded-xl text-sm bg-background border border-border">
                        تجاهل
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Selection toolbar */}
            {!result && (
              <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-3 bg-secondary/60 border border-border rounded-2xl p-3">
                <button
                  onClick={() => outpaintImage(25)}
                  disabled={loading || previewLoading}
                  className="px-3 py-2 rounded-xl text-sm text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-50"
                  style={{ background: "var(--gradient-hero)" }}
                  title="إكمال الأجزاء المقطوعة من الصورة مع الحفاظ التام على الأصل"
                >
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize2 className="w-4 h-4" />} إكمال الصورة (Outpainting)
                </button>
                <button
                  onClick={() => setSelectMode((v) => !v)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition ${selectMode ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}
                >
                  <Brush className="w-4 h-4" /> {selectMode ? "وضع التحديد مفعّل" : "تحديد منطقة"}
                </button>
                {selectMode && (
                  <>
                    <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                      <button onClick={() => setTool("brush")} className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${tool === "brush" ? "bg-primary text-primary-foreground" : ""}`}>
                        <Brush className="w-3 h-3" /> فرشاة
                      </button>
                      <button onClick={() => setTool("rect")} className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${tool === "rect" ? "bg-primary text-primary-foreground" : ""}`}>
                        <Square className="w-3 h-3" /> مستطيل
                      </button>
                    </div>
                    {tool === "brush" && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      حجم الفرشاة
                      <input type="range" min={5} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24" />
                    </label>
                    )}
                    <button onClick={() => setMaskVisible((v) => !v)} disabled={!hasMask} className="px-3 py-2 rounded-xl text-sm bg-background border border-border flex items-center gap-1 disabled:opacity-50">
                      {maskVisible ? <><EyeOff className="w-4 h-4" /> إخفاء التحديد</> : <><Eye className="w-4 h-4" /> إظهار التحديد</>}
                    </button>
                    <button onClick={clearMask} disabled={!hasMask} className="px-3 py-2 rounded-xl text-sm bg-background border border-border flex items-center gap-1 disabled:opacity-50">
                      <Eraser className="w-4 h-4" /> مسح التحديد
                    </button>
                    <button onClick={removeSelected} disabled={!hasMask || loading} className="px-3 py-2 rounded-xl text-sm text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-50" style={{ background: "var(--gradient-hero)" }}>
                      <Trash2 className="w-4 h-4" /> إزالة المحدد
                    </button>
                    <button onClick={fillSelected} disabled={!hasMask || loading || previewLoading} className="px-3 py-2 rounded-xl text-sm bg-background border border-border flex items-center gap-1 disabled:opacity-50">
                      {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand className="w-4 h-4" />} إكمال المحدد (معاينة)
                    </button>
                    <button onClick={cropSelected} disabled={tool !== "rect" || !hasMask || loading} className="px-3 py-2 rounded-xl text-sm bg-background border border-border flex items-center gap-1 disabled:opacity-50">
                      <Crop className="w-4 h-4" /> اقتصاص
                    </button>
                  </>
                )}
              </div>
            )}

            {cropPreview && selectMode && tool === "rect" && !result && (
              <div className="max-w-2xl mx-auto flex items-center gap-3 bg-secondary/60 border border-border rounded-2xl p-3">
                <div className="text-xs text-muted-foreground shrink-0">معاينة الاقتصاص الفوري:</div>
                <img src={cropPreview} alt="crop preview" className="max-h-32 rounded-lg border border-border object-contain bg-black/20" />
              </div>
            )}

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
