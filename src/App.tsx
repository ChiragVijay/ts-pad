import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "./components/Editor";
import { LoadingScreen } from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { ConnectionState, ServerError, User } from "./hooks/useWebSocket";
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
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState<ServerError | null>(
    null,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          className={`w-full flex-none overflow-y-auto border-b md:h-full md:w-80 md:border-r md:border-b-0 ${isMobileMenuOpen ? "h-full" : "h-14"}`}
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
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
