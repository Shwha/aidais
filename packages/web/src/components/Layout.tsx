import type { ReactNode } from "react";

interface LayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
}

export function Layout({ main, sidebar }: LayoutProps) {
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
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Podcast / Transcript panel */}
        <main className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          {main}
        </main>

        {/* AI Sidebar */}
        <aside className="w-96 shrink-0 border-l border-gray-800 bg-gray-950/80">
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
