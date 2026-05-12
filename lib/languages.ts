export type Language = {
  code: string;     // NLLB code (eng_Latn)
  iso: string;      // ISO 639-1 / M2M100 code (en)
  name: string;
  native: string;
  m2m?: false;      // set to false to exclude from M2M100 model (ISO collision)
};

export function langCode(lang: Language, langType: "nllb" | "m2m100"): string {
  return langType === "nllb" ? lang.code : lang.iso;
}

export function availableFor(lang: Language, langType: "nllb" | "m2m100" | "mlc" | "onnx-webgpu" | "ollama"): boolean {
  if (langType === "mlc" || langType === "onnx-webgpu" || langType === "ollama") return true;
  if (langType === "m2m100" && lang.m2m === false) return false;
  return true;
}

export const LANGUAGES: Language[] = [
  { code: "eng_Latn", iso: "en", name: "English",               native: "English" },
  { code: "fra_Latn", iso: "fr", name: "French",                native: "Français" },
  { code: "spa_Latn", iso: "es", name: "Spanish",               native: "Español" },
  { code: "deu_Latn", iso: "de", name: "German",                native: "Deutsch" },
  { code: "ita_Latn", iso: "it", name: "Italian",               native: "Italiano" },
  { code: "por_Latn", iso: "pt", name: "Portuguese",            native: "Português" },
  { code: "rus_Cyrl", iso: "ru", name: "Russian",               native: "Русский" },
  { code: "zho_Hans", iso: "zh", name: "Chinese (Simplified)",  native: "中文（简体）" },
  { code: "zho_Hant", iso: "zh", name: "Chinese (Traditional)", native: "中文（繁體）", m2m: false },
  { code: "jpn_Jpan", iso: "ja", name: "Japanese",              native: "日本語" },
  { code: "kor_Hang", iso: "ko", name: "Korean",                native: "한국어" },
  { code: "arb_Arab", iso: "ar", name: "Arabic",                native: "العربية" },
  { code: "hin_Deva", iso: "hi", name: "Hindi",                 native: "हिन्दी" },
  { code: "nld_Latn", iso: "nl", name: "Dutch",                 native: "Nederlands" },
  { code: "pol_Latn", iso: "pl", name: "Polish",                native: "Polski" },
  { code: "tur_Latn", iso: "tr", name: "Turkish",               native: "Türkçe" },
  { code: "swe_Latn", iso: "sv", name: "Swedish",               native: "Svenska" },
  { code: "nob_Latn", iso: "no", name: "Norwegian",             native: "Norsk" },
  { code: "dan_Latn", iso: "da", name: "Danish",                native: "Dansk" },
  { code: "fin_Latn", iso: "fi", name: "Finnish",               native: "Suomi" },
  { code: "ell_Grek", iso: "el", name: "Greek",                 native: "Ελληνικά" },
  { code: "ces_Latn", iso: "cs", name: "Czech",                 native: "Čeština" },
  { code: "ron_Latn", iso: "ro", name: "Romanian",              native: "Română" },
  { code: "hun_Latn", iso: "hu", name: "Hungarian",             native: "Magyar" },
  { code: "tha_Thai", iso: "th", name: "Thai",                  native: "ภาษาไทย" },
  { code: "vie_Latn", iso: "vi", name: "Vietnamese",            native: "Tiếng Việt" },
  { code: "ind_Latn", iso: "id", name: "Indonesian",            native: "Bahasa Indonesia" },
  { code: "zsm_Latn", iso: "ms", name: "Malay",                 native: "Bahasa Melayu" },
  { code: "heb_Hebr", iso: "he", name: "Hebrew",                native: "עברית" },
  { code: "ukr_Cyrl", iso: "uk", name: "Ukrainian",             native: "Українська" },
  { code: "bul_Cyrl", iso: "bg", name: "Bulgarian",             native: "Български" },
  { code: "hrv_Latn", iso: "hr", name: "Croatian",              native: "Hrvatski" },
  { code: "slk_Latn", iso: "sk", name: "Slovak",                native: "Slovenčina" },
  { code: "est_Latn", iso: "et", name: "Estonian",              native: "Eesti" },
  { code: "lvs_Latn", iso: "lv", name: "Latvian",               native: "Latviešu" },
  { code: "lit_Latn", iso: "lt", name: "Lithuanian",            native: "Lietuvių" },
  { code: "cat_Latn", iso: "ca", name: "Catalan",               native: "Català" },
  { code: "srp_Cyrl", iso: "sr", name: "Serbian",               native: "Српски" },
  { code: "ben_Beng", iso: "bn", name: "Bengali",               native: "বাংলা" },
  { code: "urd_Arab", iso: "ur", name: "Urdu",                  native: "اردو" },
  { code: "swh_Latn", iso: "sw", name: "Swahili",               native: "Kiswahili" },
  { code: "afr_Latn", iso: "af", name: "Afrikaans",             native: "Afrikaans" },
  { code: "pes_Arab", iso: "fa", name: "Persian",               native: "فارسی" },
  { code: "fil_Latn", iso: "tl", name: "Filipino",              native: "Filipino" },
  { code: "mya_Mymr", iso: "my", name: "Burmese",               native: "မြန်မာဘာသာ" },
  { code: "khm_Khmr", iso: "km", name: "Khmer",                 native: "ភាសាខ្មែរ" },
  { code: "amh_Ethi", iso: "am", name: "Amharic",               native: "አማርኛ" },
];
