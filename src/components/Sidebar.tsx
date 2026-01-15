import { APP_LANGUAGES, type LanguageDefinition } from "@/languages";
import { APP_THEMES, type ThemeDefinition } from "@/themes";
import { getUserColorClass } from "@/utils/colors";
import { useState } from "react";
import { version } from "../../package.json";
import type { User } from "../hooks/useWebSocket";

interface SidebarProps {
  theme: ThemeDefinition;
  language: LanguageDefinition;
  setThemeId: (theme: string) => void;
  setLanguageId: (language: string) => void;
  users: User[];
  currentUserId: string;
  onRenameUser: (newName: string) => void;
  docId: string;
  onClose?: () => void;
}

const Sidebar = ({
  theme,
  setThemeId,
  language,
  setLanguageId,
  users,
  currentUserId,
  onRenameUser,
  docId,
  onClose,
}: SidebarProps) => {
  const isDark = theme.type === "dark";
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [copied, setCopied] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);

  const handleStartEdit = () => {
    if (currentUser) {
      setTempName(currentUser.name);
      setEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      onRenameUser(tempName.trim());
    }
    setEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setEditingName(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/doc/${docId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div
        className={`mb-4 hidden border-b pb-4 md:block ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <h1 className="text-xl font-bold tracking-tight">TS Pad</h1>
      </div>

      <div
        className={`mb-4 border-b pb-4 ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          Connected ({users.length})
        </label>
        <div className="space-y-2">
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            return (
              <div
                key={user.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                  isCurrentUser ? (isDark ? "bg-gray-800" : "bg-gray-100") : ""
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white ${getUserColorClass(user.id)}`}
                >
                  {getInitials(user.name)}
                </div>
                {isCurrentUser && editingName ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className={`flex-1 rounded border px-1 py-0.5 text-xs outline-none ${
                      isDark
                        ? "border-gray-600 bg-gray-700 text-white"
                        : "border-gray-300 bg-white text-black"
                    }`}
                  />
                ) : (
                  <span
                    className={`flex-1 truncate text-xs ${
                      isCurrentUser ? "cursor-pointer hover:underline" : ""
                    }`}
                    onClick={isCurrentUser ? handleStartEdit : undefined}
                    title={
                      isCurrentUser ? "Click to edit your name" : user.name
                    }
                  >
                    {user.name}
                    {isCurrentUser && (
                      <span className="ml-1 text-[10px] text-gray-500">
                        (you)
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`mb-4 border-b pb-4 ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <button
          onClick={handleCopyLink}
          className={`w-full rounded-md border px-3 py-2 text-xs font-medium transition-all ${
            isDark
              ? "border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
              : "border-gray-300 bg-white text-black hover:bg-gray-50"
          }`}
        >
          {copied ? "✓ Copied!" : "📋 Copy Share Link"}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Theme
          </label>
          <select
            className={`w-full rounded-md border px-3 py-2 text-sm transition-all outline-none ${
              isDark
                ? "border-gray-700 bg-gray-800 text-white focus:border-blue-500"
                : "border-gray-300 bg-white text-black focus:border-blue-500"
            }`}
            value={theme.id}
            onChange={(e) => {
              setThemeId(e.target.value);
              onClose?.();
            }}
          >
            {APP_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Language
          </label>
          <select
            className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
              isDark
                ? "border-gray-700 bg-gray-800 text-white focus:border-blue-500"
                : "border-gray-300 bg-white text-black focus:border-blue-500"
            }`}
            value={language.id}
            onChange={(e) => {
              setLanguageId(e.target.value);
              onClose?.();
            }}
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

      <div className="mt-auto pt-4">
        <p className="text-[10px] tracking-widest text-gray-400 uppercase">
          v{version}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
