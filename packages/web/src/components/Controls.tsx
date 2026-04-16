import { useSessionStore } from "../stores/session.store";

interface ControlsProps {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  error: string | null;
}

export function Controls({ isListening, onStart, onStop, error }: ControlsProps) {
  const isConnected = useSessionStore((s) => s.isConnected);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      {/* Connection indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-gray-400">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Start/Stop button */}
      <button
        onClick={isListening ? onStop : onStart}
        disabled={!isConnected}
        className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
          isListening
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400"
        }`}
      >
        {isListening ? "Stop" : "Start Listening"}
      </button>

      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs text-gray-300">Listening...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
