import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "./components/Editor";
import { LoadingScreen } from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { ConnectionState, ServerError, User } from "./hooks/useWebSocket";
import { APP_LANGUAGES } from "./languages";
import { APP_THEMES } from "./themes";

const MenuIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

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
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState<ServerError | null>(
    null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const renameUserRef = useRef<((name: string) => void) | null>(null);

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state);
  }, []);

  const handleError = useCallback((error: ServerError | null) => {
    setConnectionError(error);
  }, []);

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
      <LoadingScreen
        connectionState="connecting"
        error={null}
        isDark={isDark}
      />
    );
  }

  const showLoadingOverlay = connectionState !== "connected" || connectionError;

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden transition-colors duration-300 ${isDark ? "bg-gray-900 text-white" : "bg-white text-black"}`}
    >
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-50">
          <LoadingScreen
            connectionState={connectionState}
            error={connectionError}
            isDark={isDark}
          />
        </div>
      )}

      <header
        className={`flex h-12 flex-none items-center justify-between border-b px-4 md:hidden ${
          isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"
        }`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`rounded-lg p-2 transition-colors ${
            isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
          }`}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <h1 className="text-lg font-bold tracking-tight">TS Pad</h1>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-40 w-72 transform overflow-y-auto border-r transition-transform duration-200 ease-in-out md:relative md:z-0 md:w-72 md:translate-x-0 md:transition-none lg:w-80 ${
            isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"
          } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Sidebar
            theme={currentTheme}
            setThemeId={setThemeId}
            language={currentLanguage}
            setLanguageId={setLanguageId}
            users={users}
            currentUserId={userId}
            onRenameUser={handleRenameUser}
            docId={docId}
            onClose={() => setSidebarOpen(false)}
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
            onConnectionStateChange={handleConnectionStateChange}
            onError={handleError}
            renameUserRef={renameUserRef}
          />
        </main>
      </div>
    </div>
  );
}
