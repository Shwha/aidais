import { useRef, useEffect } from "react";
import { useSessionStore } from "../stores/session.store";

export function TranscriptFeed() {
  const entries = useSessionStore((s) => s.transcriptEntries);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Live Transcript
      </h3>
      <div className="space-y-1">
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            Start a session and speak to see the live transcript here.
          </p>
        )}
        {entries.map((entry, i) => (
          <span
            key={`${entry.timestamp}-${i}`}
            className={`inline ${
              entry.isFinal ? "text-gray-200" : "text-gray-500 italic"
            }`}
          >
            {entry.text}{" "}
          </span>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
