import Translator from "@/components/Translator";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none">
              T
            </div>
            <span className="text-base font-semibold text-slate-800">
              BrowserTranslate
            </span>
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
            Runs on your device · Always free
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Translator />
      </div>
    </main>
  );
}
