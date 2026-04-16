import type { ReactNode } from "react";
import { useSessionStore } from "../stores/session.store";
import type { StreamView } from "../stores/session.store";

interface LayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
}

export function Layout({ main, sidebar }: LayoutProps) {
  const streamView = useSessionStore((s) => s.streamView);
  const setStreamView = useSessionStore((s) => s.setStreamView);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center border-b border-gray-800 bg-gray-950 px-6 py-3">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-blue-500">AI</span>
          <span className="text-white">DAIS</span>
        </h1>
        <span className="ml-3 rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
          Real-time AI Podcast Companion
        </span>

        {/* Stream view toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 p-0.5">
          <StreamToggleBtn
            active={streamView === "regular"}
            onClick={() => setStreamView("regular")}
            label="Regular"
          />
          <StreamToggleBtn
            active={streamView === "enhanced"}
            onClick={() => setStreamView("enhanced")}
            label="Enhanced"
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Podcast / Transcript panel */}
        <main className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          {main}
        </main>

        {/* AI Sidebar — only visible in Enhanced mode */}
        {streamView === "enhanced" && (
          <aside className="w-96 shrink-0 border-l border-gray-800 bg-gray-950/80">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}

function StreamToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
