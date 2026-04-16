import type { PersonaId } from "@aidais/shared";
import { PersonaBubble } from "./PersonaBubble";

const PERSONA_IDS: PersonaId[] = [
  "fact-checker",
  "cynical-troll",
  "chaos-agent",
  "joke-writer",
];

interface SidebarProps {
  onToggleChaosMode?: () => void;
}

export function Sidebar({ onToggleChaosMode }: SidebarProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        AI Sidebar
      </h2>
      {PERSONA_IDS.map((id) => (
        <PersonaBubble
          key={id}
          personaId={id}
          onToggleChaosMode={id === "chaos-agent" ? onToggleChaosMode : undefined}
        />
      ))}
    </div>
  );
}
