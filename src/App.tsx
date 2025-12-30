import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { User } from "./hooks/useWebSocket";
import { APP_LANGUAGES } from "./languages";
import { APP_THEMES } from "./themes";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getDocIdFromUrl(): string | null {
  const [, docPrefix, docId] = window.location.pathname.split("/");
  return docPrefix === "doc" ? docId : null;
}

export function App() {
  const [themeId, setThemeId] = useLocalStorage("tspad-theme", "light");
  const [languageId, setLanguageId] = useLocalStorage(
    "tspad-lang",
    "typescript",
  );
  const [storedUserId, setStoredUserId] = useLocalStorage("tspad-user-id", "");
  const [storedUsername, setStoredUsername] = useLocalStorage(
    "tspad-username",
    "",
  );

  const userId = useMemo(() => {
    if (storedUserId) return storedUserId;
    const newId = generateId();
    setStoredUserId(newId);
    return newId;
  }, [storedUserId, setStoredUserId]);

  const username = useMemo(() => {
    if (storedUsername) return storedUsername;
    const defaultName = `User-${userId.slice(0, 4)}`;
    setStoredUsername(defaultName);
    return defaultName;
  }, [storedUsername, setStoredUsername, userId]);

  const [docId, setDocId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const renameUserRef = useRef<((name: string) => void) | null>(null);

  useEffect(() => {
    const urlDocId = getDocIdFromUrl();
    if (urlDocId) {
      setDocId(urlDocId);
    } else {
      const newDocId = generateId();
      window.history.replaceState(null, "", `/doc/${newDocId}`);
      setDocId(newDocId);
    }
  }, []);

  const handleRenameUser = (newName: string) => {
    setStoredUsername(newName);
    renameUserRef.current?.(newName);
  };

  const currentTheme =
    APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0];
  const currentLanguage =
    APP_LANGUAGES.find((l) => l.id === languageId) || APP_LANGUAGES[0];
  const isDark = currentTheme.type === "dark";

  if (!docId) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${isDark ? "bg-gray-900 text-white" : "bg-white text-black"}`}
      >
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

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
            users={users}
            currentUserId={userId}
            onRenameUser={handleRenameUser}
            docId={docId}
          />
        </aside>

        <main className="flex-1 overflow-hidden">
          <Editor
            theme={currentTheme}
            language={currentLanguage}
            docId={docId}
            userId={userId}
            username={username}
            onUsersChange={setUsers}
            onRenameUser={handleRenameUser}
            onLanguageChange={setLanguageId}
            renameUserRef={renameUserRef}
          />
        </main>
      </div>
    </div>
  );
}
