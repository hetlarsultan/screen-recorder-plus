import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageDataUrl: z.string().min(10),
  prompt: z.string().min(1).max(1000),
});

export const editImage = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: data.prompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز الحد. حاول لاحقاً.");
      if (res.status === 402) throw new Error("الرصيد غير كافٍ. يرجى إضافة رصيد.");
      throw new Error(`فشل التوليد: ${t.slice(0, 200)}`);
    }

    const json = await res.json() as any;
    const img = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!img) throw new Error("لم يتم إرجاع صورة");
    return { image: img as string };
  });