# AIDAIS

Real-time AI podcast companion — four AI personas deliver live commentary as a sidebar overlay.

Built for the [TWiST $5K Bounty](https://x.com/twistartups).

## What It Does

AIDAIS listens to a podcast or live stream in real time and generates live feedback from four distinct AI personas, each inspired by Howard Stern Show staff dynamics:

| Persona | Role |
|---|---|
| **Baba Booey** (Fact Checker) | Monitors factual claims, provides corrections and verifications |
| **The Troll** (Cynical Commentator) | Delivers skeptical, witty, edgy feedback |
| **Chaos** (Chaos Agent) | Introduces unpredictable, disruptive angles |
| **Jackie** (Joke Writer) | Generates relevant one-liners and humorous takes |

Each persona appears as a visual bubble in a sidebar with animated sine wave activity indicators.

## Quick Start

```bash
git clone https://github.com/shwha/aidais.git
cd aidais
cp .env.example .env             # add your API key
pnpm install
pnpm dev                         # server on :3001, web on :5173
```

Open http://localhost:5173 in Chrome, click Start, and speak into your microphone.

## Configuration

Copy `.env.example` to `.env` and set your LLM provider:

```bash
# Pick your LLM provider
LLM_PROVIDER=xai                 # "xai" | "anthropic" | "openai"
LLM_MODEL=grok-3                 # provider-specific model ID

# Set the API key for your chosen provider
XAI_API_KEY=your_key_here        # for xAI Grok
# ANTHROPIC_API_KEY=             # for Anthropic Claude
# OPENAI_API_KEY=                # for OpenAI
```

Speech-to-text uses the browser's built-in Web Speech API by default — no additional API keys needed.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS 4
- **Backend:** Hono on Node.js
- **LLM:** Provider-agnostic (xAI Grok, Anthropic Claude, OpenAI)
- **Speech-to-Text:** Web Speech API (default) or Deepgram (optional)
- **Real-time:** WebSockets
- **Chrome Extension:** YouTube tab audio capture + sidebar injection

## Project Structure

```
packages/
  shared/     # types, persona definitions, validation schemas
  server/     # Hono backend, LLM provider adapters, agent orchestrator
  web/        # React frontend, persona bubbles, audio visualization
  extension/  # Chrome extension for YouTube integration
```

## Security

- API keys are stored in `.env` only (gitignored, never committed)
- All inputs validated with Zod schemas
- CORS restricted to explicit origins
- WebSocket connections authenticated
- See [SECURITY.md](SECURITY.md) for vulnerability reporting

## License

[MIT](LICENSE)
