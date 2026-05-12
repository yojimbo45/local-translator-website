/**
 * BrowserTranslate — public translation API
 * Powered by Cloudflare Workers AI (@cf/meta/m2m100-1.2b)
 *
 * POST /translate  { text, source, target }  → { translation }
 * GET  /languages  → { languages: [...] }
 * GET  /           → API info
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ISO 639-1 codes supported by M2M100
const LANGUAGES = {
  af: "Afrikaans", am: "Amharic", ar: "Arabic", az: "Azerbaijani",
  be: "Belarusian", bg: "Bulgarian", bn: "Bengali", bs: "Bosnian",
  ca: "Catalan", cs: "Czech", cy: "Welsh", da: "Danish",
  de: "German", el: "Greek", en: "English", es: "Spanish",
  et: "Estonian", fa: "Persian", fi: "Finnish", fr: "French",
  ga: "Irish", gl: "Galician", gu: "Gujarati", ha: "Hausa",
  he: "Hebrew", hi: "Hindi", hr: "Croatian", hu: "Hungarian",
  hy: "Armenian", id: "Indonesian", ig: "Igbo", is: "Icelandic",
  it: "Italian", ja: "Japanese", ka: "Georgian", kk: "Kazakh",
  km: "Khmer", kn: "Kannada", ko: "Korean", lo: "Lao",
  lt: "Lithuanian", lv: "Latvian", mg: "Malagasy", mk: "Macedonian",
  ml: "Malayalam", mn: "Mongolian", mr: "Marathi", ms: "Malay",
  my: "Burmese", ne: "Nepali", nl: "Dutch", no: "Norwegian",
  or: "Odia", pa: "Punjabi", pl: "Polish", ps: "Pashto",
  pt: "Portuguese", ro: "Romanian", ru: "Russian", sd: "Sindhi",
  si: "Sinhala", sk: "Slovak", sl: "Slovenian", so: "Somali",
  sq: "Albanian", sr: "Serbian", su: "Sundanese", sv: "Swedish",
  sw: "Swahili", ta: "Tamil", th: "Thai", tl: "Filipino",
  tr: "Turkish", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek",
  vi: "Vietnamese", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba",
  zh: "Chinese", zu: "Zulu",
};

const json = (data, status = 200) =>
  Response.json(data, { status, headers: CORS });

function validate(body) {
  const { text, source = "en", target } = body ?? {};

  if (!text || typeof text !== "string" || !text.trim())
    return "text is required";
  if (text.length > 2000)
    return "text exceeds 2000 character limit";
  if (!target)
    return "target language code is required";
  if (!LANGUAGES[source])
    return `unsupported source language: "${source}"`;
  if (!LANGUAGES[target])
    return `unsupported target language: "${target}"`;
  if (source === target)
    return "source and target must be different";

  return null;
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { pathname } = new URL(request.url);

    // ── GET / ────────────────────────────────────────────────────────────
    if (pathname === "/" && request.method === "GET") {
      return json({
        name: "BrowserTranslate API",
        model: "@cf/meta/m2m100-1.2b",
        languages: Object.keys(LANGUAGES).length,
        endpoints: {
          "POST /translate": {
            body: { text: "string (max 2000)", source: "ISO 639-1 (default: en)", target: "ISO 639-1" },
            response: { translation: "string", source: "string", target: "string", ms: "number" },
          },
          "GET /languages": "returns all supported language codes and names",
        },
        limits: { chars_per_request: 2000 },
      });
    }

    // ── GET /languages ────────────────────────────────────────────────────
    if (pathname === "/languages" && request.method === "GET") {
      return json({
        languages: Object.entries(LANGUAGES).map(([code, name]) => ({ code, name })),
      });
    }

    // ── POST /translate ───────────────────────────────────────────────────
    if (pathname === "/translate" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const err = validate(body);
      if (err) return json({ error: err }, 400);

      const { text, source = "en", target } = body;
      const t0 = Date.now();

      try {
        const result = await env.AI.run("@cf/meta/m2m100-1.2b", {
          text: text.trim(),
          source_lang: source,
          target_lang: target,
        });

        return json({
          translation: result.translated_text,
          source,
          target,
          ms: Date.now() - t0,
        });
      } catch (e) {
        return json({ error: "Translation failed", detail: e.message }, 502);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
