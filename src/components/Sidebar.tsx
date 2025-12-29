import { APP_LANGUAGES, type LanguageDefinition } from "@/languages";
import { APP_THEMES, type ThemeDefinition } from "@/themes";

interface SidebarProps {
  theme: ThemeDefinition;
  language: LanguageDefinition;
  setThemeId: (theme: string) => void;
  setLanguageId: (language: string) => void;
}

const Sidebar = ({
  theme,
  setThemeId,
  language,
  setLanguageId,
}: SidebarProps) => {
  const isDark = theme.type === "dark";
  return (
    <div className="flex h-full flex-row items-center justify-between px-4 md:flex-col md:items-stretch md:p-4">
      <div
        className={`mb-8 hidden border-b pb-4 md:block ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <h1 className="text-xl font-bold tracking-tight">TS Pad</h1>
      </div>

      <div className="flex flex-row items-center gap-3 md:flex-col md:items-stretch md:gap-6">
        <div className="flex items-center gap-2 md:flex-col md:items-stretch">
          <label className="hidden text-[10px] font-bold tracking-widest text-gray-500 uppercase lg:block">
            Theme
          </label>
          <select
            className={`rounded-md border px-2 py-1 text-xs transition-all outline-none md:px-3 md:py-2 md:text-sm ${
              isDark
                ? "border-gray-700 bg-gray-800 text-white focus:border-blue-500"
                : "border-gray-300 bg-white text-black focus:border-blue-500"
            }`}
            value={theme.id}
            onChange={(e) => setThemeId(e.target.value)}
          >
            {APP_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 md:flex-col md:items-stretch">
          <label className="hidden text-[10px] font-bold tracking-widest text-gray-500 uppercase lg:block">
            Language
          </label>
          <select
            className={`rounded-md border px-2 py-1 text-xs outline-none md:px-3 md:py-2 md:text-sm ${
              isDark
                ? "border-gray-700 bg-gray-800 text-white"
                : "border-gray-300 bg-white text-black"
            }`}
            value={language.id}
            onChange={(e) => setLanguageId(e.target.value)}
          >
            {APP_LANGUAGES.sort((a, b) => a.label.localeCompare(b.label)).map(
              (l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div className="mt-auto hidden pt-4 md:block">
        <p className="text-[10px] tracking-widest text-gray-400 uppercase">
          v0.0.1
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
