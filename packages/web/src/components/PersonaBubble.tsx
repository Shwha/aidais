import type { PersonaId, AgentMessage } from "@aidais/shared";
import { PERSONAS } from "@aidais/shared";
import { useSessionStore } from "../stores/session.store";
import { SineWave } from "./SineWave";

interface PersonaBubbleProps {
  personaId: PersonaId;
}

export function PersonaBubble({ personaId }: PersonaBubbleProps) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  const messages = useSessionStore((s) => s.agentMessages[personaId]);
  const streaming = useSessionStore((s) => s.streamingMessages[personaId]);

  if (!persona) return null;

  const isActive = streaming !== null;
  const displayMessages = [...messages].reverse().slice(0, 5).reverse();

  return (
    <div
      className="rounded-xl border p-4 backdrop-blur-sm transition-all duration-300"
      style={{
        borderColor: isActive ? persona.color : "#374151",
        backgroundColor: isActive
          ? `${persona.color}10`
          : "rgba(17, 24, 39, 0.6)",
        boxShadow: isActive
          ? `0 0 20px ${persona.color}20`
          : "none",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <img
          src={persona.avatar}
          alt={persona.name}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {persona.name}
          </div>
          <div className="text-xs text-gray-400">{persona.displayName}</div>
        </div>
        {isActive && (
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: persona.color }} />
        )}
      </div>

      {/* Sine wave */}
      <SineWave isActive={isActive} color={persona.color} />

      {/* Messages */}
      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {displayMessages.map((msg: AgentMessage) => (
          <div
            key={msg.id}
            className="rounded-lg bg-gray-800/50 px-3 py-2 text-sm text-gray-200"
          >
            {msg.text}
          </div>
        ))}

        {/* Currently streaming message */}
        {streaming && (
          <div className="streaming-cursor rounded-lg bg-gray-800/50 px-3 py-2 text-sm text-gray-200">
            {streaming.text}
          </div>
        )}

        {/* Empty state */}
        {displayMessages.length === 0 && !streaming && (
          <div className="py-4 text-center text-xs text-gray-500">
            Waiting for conversation...
          </div>
        )}
      </div>
    </div>
  );
}
