import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { APP_LANGUAGES } from "./languages";
import { APP_THEMES } from "./themes";

export function App() {
  const [themeId, setThemeId] = useLocalStorage("tspad-theme", "light");
  const [languageId, setLanguageId] = useLocalStorage(
    "tspad-lang",
    "typescript",
  );

  const currentTheme =
    APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0];
  const currentLanguage =
    APP_LANGUAGES.find((l) => l.id === languageId) || APP_LANGUAGES[0];
  const isDark = currentTheme.type === "dark";

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden transition-colors duration-300 ${isDark ? "bg-gray-900 text-white" : "bg-white text-black"}`}
    >
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="h-14 w-full flex-none overflow-y-auto border-b md:h-full md:w-80 md:border-r md:border-b-0">
          <Sidebar
            theme={currentTheme}
            setThemeId={setThemeId}
            language={currentLanguage}
            setLanguageId={setLanguageId}
          />
        </aside>

        <main className="flex-1 overflow-hidden">
          <Editor theme={currentTheme} language={currentLanguage} />
        </main>
      </div>
    </div>
  );
}
