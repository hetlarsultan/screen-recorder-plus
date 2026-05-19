import { useRef, useState } from "react";
import { Upload, Video, Camera, Download, Trash2, Play, Pause } from "lucide-react";
import { toast } from "sonner";

type Frame = { id: string; url: string; time: number; w: number; h: number };

export function VideoFrameCapture({ onBack }: { onBack: () => void }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState<{ w: number; h: number; d: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("الرجاء اختيار ملف فيديو"); return; }
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setFrames([]);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { toast.error("الفيديو غير جاهز"); return; }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    setFrames((prev) => [
      { id: crypto.randomUUID(), url, time: v.currentTime, w: c.width, h: c.height },
      ...prev,
    ]);
    toast.success(`تم الالتقاط بدقة ${c.width}×${c.height}`);
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const download = (f: Frame) => {
    const a = document.createElement("a");
    a.href = f.url;
    a.download = `frame-${f.time.toFixed(2)}s-${f.w}x${f.h}.png`;
    a.click();
  };

  const downloadAll = () => {
    frames.forEach((f, i) => setTimeout(() => download(f), i * 150));
  };

  const remove = (id: string) => setFrames((p) => p.filter((f) => f.id !== id));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" /> التقاط صور من الفيديو
        </h2>
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← رجوع
        </button>
      </div>

      {!videoUrl ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
          className="cursor-pointer mx-auto max-w-xl border-2 border-dashed border-border rounded-3xl p-12 hover:border-primary transition-colors text-center"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-semibold">اضغط أو اسحب فيديو هنا</p>
          <p className="text-sm text-muted-foreground mt-1">MP4, WEBM, MOV — يتم الالتقاط بالدقة الأصلية للفيديو</p>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative mx-auto max-w-3xl rounded-2xl overflow-hidden border border-border bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setMeta({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className="w-full max-h-[60vh] bg-black"
            />
          </div>

          {meta && (
            <p className="text-xs text-muted-foreground text-center">
              الدقة الأصلية: {meta.w}×{meta.h} · المدة: {meta.d.toFixed(1)}s
            </p>
          )}

          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2 bg-secondary/60 border border-border rounded-2xl p-3">
            <button onClick={() => seek(-1 / 30)} className="px-3 py-2 rounded-xl text-sm bg-background border border-border">⏮ إطار</button>
            <button onClick={() => seek(-0.5)} className="px-3 py-2 rounded-xl text-sm bg-background border border-border">-0.5s</button>
            <button onClick={toggle} className="px-3 py-2 rounded-xl text-sm bg-background border border-border flex items-center gap-1">
              {playing ? <><Pause className="w-4 h-4" /> إيقاف</> : <><Play className="w-4 h-4" /> تشغيل</>}
            </button>
            <button onClick={() => seek(0.5)} className="px-3 py-2 rounded-xl text-sm bg-background border border-border">+0.5s</button>
            <button onClick={() => seek(1 / 30)} className="px-3 py-2 rounded-xl text-sm bg-background border border-border">إطار ⏭</button>
            <button
              onClick={capture}
              className="px-4 py-2 rounded-xl text-sm text-primary-foreground font-semibold flex items-center gap-1"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Camera className="w-4 h-4" /> التقاط بأعلى دقة
            </button>
          </div>

          {frames.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between max-w-5xl mx-auto">
                <p className="text-sm text-muted-foreground">{frames.length} لقطة</p>
                <button onClick={downloadAll} className="px-3 py-2 rounded-xl text-sm bg-accent text-accent-foreground flex items-center gap-1">
                  <Download className="w-4 h-4" /> تنزيل الكل
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
                {frames.map((f) => (
                  <div key={f.id} className="group relative rounded-xl overflow-hidden border border-border bg-secondary/30">
                    <img src={f.url} alt={`frame ${f.time}`} className="w-full aspect-video object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-2 py-1 flex items-center justify-between">
                      <span>{f.time.toFixed(2)}s · {f.w}×{f.h}</span>
                    </div>
                    <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => download(f)} className="p-1.5 rounded-md bg-primary text-primary-foreground" title="تنزيل">
                        <Download className="w-3 h-3" />
                      </button>
                      <button onClick={() => remove(f.id)} className="p-1.5 rounded-md bg-destructive text-destructive-foreground" title="حذف">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}