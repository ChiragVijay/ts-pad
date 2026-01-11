import type { ConnectionState, ServerError } from "../hooks/useWebSocket";

interface LoadingScreenProps {
  connectionState: ConnectionState;
  error: ServerError | null;
  isDark: boolean;
}

export function LoadingScreen({
  connectionState,
  error,
  isDark,
}: LoadingScreenProps) {
  const bgClass = isDark ? "bg-gray-900" : "bg-slate-50";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const subtextClass = isDark ? "text-gray-400" : "text-gray-500";
  const accentClass = isDark ? "text-cyan-400" : "text-indigo-600";
  const spinnerBg = isDark ? "border-gray-700" : "border-gray-200";
  const spinnerAccent = isDark ? "border-t-cyan-400" : "border-t-indigo-600";

  if (error) {
    return (
      <div
        className={`flex h-screen flex-col items-center justify-center ${bgClass} ${textClass}`}
      >
        <div className="max-w-md px-6 text-center">
          <div className="mb-6 text-5xl">⚠️</div>
          <h1 className="mb-3 text-xl font-semibold">Unable to Connect</h1>
          <p className={`mb-6 text-sm ${subtextClass}`}>{error.message}</p>
          {error.code === "DOCUMENT_LIMIT" && (
            <p className={`text-xs ${subtextClass}`}>
              This is a demo deployment with limited capacity. Please try again
              later or create a new document.
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className={`mt-4 rounded-lg px-6 py-2 text-sm font-medium transition-colors ${
              isDark
                ? "bg-cyan-600 text-white hover:bg-cyan-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isConnecting = connectionState === "connecting";
  const isDisconnected = connectionState === "disconnected";

  return (
    <div
      className={`flex h-screen flex-col items-center justify-center ${bgClass} ${textClass}`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <div
          className={`mb-8 h-12 w-12 animate-spin rounded-full border-4 ${spinnerBg} ${spinnerAccent}`}
        />

        <h1 className={`mb-2 text-2xl font-bold tracking-tight ${accentClass}`}>
          TS Pad
        </h1>

        <p className={`mb-4 text-sm ${subtextClass}`}>
          {isConnecting && "Connecting to server..."}
          {isDisconnected && "Reconnecting..."}
        </p>

        {isConnecting && (
          <div
            className={`max-w-sm rounded-lg border px-4 py-3 ${
              isDark
                ? "border-gray-700 bg-gray-800/50"
                : "border-gray-200 bg-white"
            }`}
          >
            <p className={`text-xs ${subtextClass}`}>
              The server may take up to 30 seconds on cold start.
            </p>
          </div>
        )}

        {isDisconnected && (
          <p className={`text-xs ${subtextClass}`}>
            Connection lost. Attempting to reconnect...
          </p>
        )}
      </div>
    </div>
  );
}
