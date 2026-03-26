import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const SYSTEM_PROMPT = `Tu es un tuteur Power BI et DAX. Tu aides un apprenant qui prépare la certification PL-300.

RÈGLES DE STYLE :
- Réponds en français
- Sois CONCIS : 3-5 phrases max pour une réponse simple, 10 phrases max pour un problème complexe
- Pas de longs pavés ni de blocs répétitifs — va droit au but
- Utilise le markdown : **gras** pour les mots clés, \`code\` pour le DAX/M, listes numérotées pour les étapes
- Si la question est courte, la réponse est courte. Pas besoin de 3 paragraphes pour dire "utilise DIVIDE"

CONTENU :
- Base AdventureWorks PostgreSQL (tables : Sales, Orders, Product, Customer, Territory, ProductCategory, ProductSubcategory)
- Si la question concerne du DAX, donne la formule exacte + une ligne d'explication
- Si on t'envoie une capture d'écran Power BI, analyse-la : identifie le problème visible et donne la solution directement
- Si tu ne sais pas, dis-le en une phrase

NE FAIS PAS :
- Ne demande pas "peux-tu me donner plus de détails" si l'image ou le contexte suffit à répondre
- Ne liste pas 3 hypothèses quand une seule est probable — tranche
- Ne répète pas la question de l'utilisateur dans ta réponse`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers":
          "authorization, content-type, x-client-info, apikey",
      },
    });
  }

  try {
    const { message, context, history, image } = await req.json();
    const systemPrompt =
      SYSTEM_PROMPT +
      (context ? `\n\nContexte actuel de l'apprenant : ${context}` : "");

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        const parts: any[] = [];
        // Include image from history if present (base64 data URI)
        if (msg.image && typeof msg.image === "string" && msg.image.startsWith("data:")) {
          const match = msg.image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
        if (msg.text) parts.push({ text: msg.text });
        if (parts.length > 0) {
          contents.push({
            role: msg.role === "bot" ? "model" : "user",
            parts,
          });
        }
      }
    }

    // Build user message parts (text + optional image)
    const userParts: any[] = [];
    if (image && image.mimeType && image.data) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      });
    }
    userParts.push({ text: message.trim().slice(0, 2000) });

    contents.push({
      role: "user",
      parts: userParts,
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await geminiResponse.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";

    return new Response(JSON.stringify({ reply }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
