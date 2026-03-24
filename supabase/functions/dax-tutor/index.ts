import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const SYSTEM_PROMPT = `Tu es un tuteur Power BI et DAX. Tu aides un apprenant qui prépare la certification PL-300.
- Réponds en français, de manière claire et structurée
- Utilise des listes numérotées pour les étapes et procédures
- Utilise des exemples concrets avec la base AdventureWorks PostgreSQL (tables : Sales=sales.salesorderdetail, Orders=sales.salesorderheader, Product=production.product, Customer=sales.customer, Territory=sales.salesterritory)
- Si la question concerne du DAX, donne la formule exacte avec explication
- Si on t'envoie une capture d'écran Power BI, analyse-la en détail (visuels, modèle, DAX, erreurs) et donne des conseils
- Reste concis mais complet — ne coupe jamais une explication en plein milieu
- Si tu ne sais pas, dis-le honnêtement`;

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
        contents.push({
          role: msg.role === "bot" ? "model" : "user",
          parts: [{ text: msg.text }],
        });
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
