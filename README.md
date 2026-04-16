# AIDAIS

Real-time AI podcast companion -- four AI personas deliver live commentary as a collapsible sidebar overlay on YouTube.

Built for the [TWiST $5K Bounty](https://x.com/twistartups).

## What It Does

AIDAIS listens to a podcast or live stream **directly from the browser tab** (no microphone needed) and generates live feedback from four distinct AI personas:

| Persona | Role | Style |
|---|---|---|
| **Baba Booey** | Fact Checker | Verifies claims, provides corrections with sources |
| **The Troll** | Cynical Commentator | Skeptical, witty, finds the weak points |
| **Chaos / Not Fred Norris** | Chaos Agent / Sound Effects & Context | Toggleable -- wildcard angles OR background context with sound cues |
| **Not Jackie** | Joke Writer | One-liners and punchlines timed to the conversation |

The sidebar supports two view modes: **Regular** (just the stream) and **Enhanced** (stream + AI sidebar). Each persona has animated sine wave activity indicators and streams responses token-by-token.

## Requirements

You need **two free/paid API keys** to run AIDAIS:

### 1. LLM Provider Key (powers the AI agents)

Pick **one** of the following. The backend is fully provider-agnostic -- switch providers by changing one env var.

| Provider | Env Var | Sign Up | Models |
|---|---|---|---|
| **xAI Grok** (default) | `XAI_API_KEY` | [console.x.ai](https://console.x.ai) | `grok-3`, `grok-3-mini` |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | `claude-sonnet-4-20250514` |
| **OpenAI** | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | `gpt-4o`, `gpt-4o-mini` |

### 2. Groq Whisper Key (transcribes audio from the video)

**Required for the Chrome extension** to transcribe podcast/video audio directly from the browser tab without a microphone.

- **Free** -- no credit card required
- Sign up at [console.groq.com](https://console.groq.com)
- Create an API key and add it as `WHISPER_API_KEY` in your `.env`
- Uses Whisper Large V3 for high-accuracy English transcription

> Without the Groq key, the web app still works using your microphone via the browser's built-in Web Speech API. The Chrome extension requires the Groq key for tab audio capture.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+ (`npm install -g pnpm`)
- Google Chrome (for the extension)

### Setup

```bash
git clone https://github.com/shwha/aidais.git
cd aidais
pnpm install
cp .env.example .env
```

Edit `.env` with your API keys:

```bash
# LLM -- pick one provider and set its key
LLM_PROVIDER=xai
LLM_MODEL=grok-3
XAI_API_KEY=your_xai_key_here

# Whisper transcription (FREE - get key at console.groq.com)
WHISPER_API_KEY=your_groq_key_here
WHISPER_API_URL=https://api.groq.com/openai/v1
WHISPER_MODEL=whisper-large-v3
```

Start the server:

```bash
pnpm dev    # server on :3002, web UI on :5173
```

### Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `packages/extension` folder from this repo
5. Navigate to any YouTube video
6. Click the **AIDAIS icon** in the Chrome toolbar

The sidebar appears on the right side of YouTube. The extension captures audio directly from the video tab -- no microphone needed.

### Sidebar Controls

- **Pause / Play** -- toggles agent processing on/off
- **Hide** -- collapses the sidebar (click the "AI" tab on the edge to reopen)
- **SFX** button on Chaos Agent -- toggles between Chaos mode and Not Fred Norris (Sound Effects & Context) mode
- **Stop & Close** -- fully disconnects and removes the sidebar

### Web App (alternative)

Open `https://localhost:5173` in Chrome for the standalone web app. This version uses your microphone for transcription and includes an embedded video player where you can paste YouTube/Twitch URLs. Toggle between **Regular** and **Enhanced** views in the header.

## How It Works

```
YouTube Tab                    AIDAIS Server                   Extension Sidebar
-----------                    -------------                   -----------------
[Video audio] ---> Tab Capture ---> Whisper (Groq) ---> Transcript
                   (5-10s chunks)   (STT)                    |
                                                             v
                                                      Agent Orchestrator
                                                      (10s debounce, sliding context)
                                                      |     |     |     |
                                                      v     v     v     v
                                                    [BB]  [Troll] [Chaos] [NJ]
                                                    Grok   Grok   Grok   Grok
                                                      |     |     |     |
                                                      v     v     v     v
                                                      WebSocket broadcast
                                                             |
                                                             v
                                                      Persona Bubbles
                                                      (streaming tokens)
```

## Configuration Reference

All configuration is in `.env` (never committed to git):

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | No | `xai` | LLM provider: `xai`, `anthropic`, or `openai` |
| `LLM_MODEL` | No | `grok-3` | Model ID for your chosen provider |
| `XAI_API_KEY` | If using xAI | -- | xAI Grok API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | -- | Anthropic Claude API key |
| `OPENAI_API_KEY` | If using OpenAI | -- | OpenAI API key |
| `WHISPER_API_KEY` | For extension | -- | Groq API key (free at console.groq.com) |
| `WHISPER_API_URL` | No | `https://api.groq.com/openai/v1` | Whisper-compatible API endpoint |
| `WHISPER_MODEL` | No | `whisper-large-v3` | Whisper model ID |
| `PORT` | No | `3002` | Server port |
| `CORS_ORIGIN` | No | `https://localhost:5173` | Allowed CORS origin |
| `LOG_LEVEL` | No | `info` | Logging: `verbose`, `debug`, `info`, `warn`, `error` |

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS 4
- **Backend:** Hono on Node.js with WebSocket support
- **LLM:** Provider-agnostic adapter pattern (xAI Grok, Anthropic Claude, OpenAI)
- **Speech-to-Text:** Groq Whisper (tab audio) / Web Speech API (mic fallback)
- **State:** Zustand
- **Real-time:** WebSockets (bidirectional streaming)
- **Extension:** Chrome Manifest V3 with offscreen document for tab audio capture
- **Validation:** Zod schemas on all WebSocket messages

## Project Structure

```
packages/
  shared/      # Types, persona definitions, Zod validation, LLM provider interface
  server/      # Hono backend, LLM adapters, agent orchestrator, Whisper transcription
  web/         # React frontend, persona bubbles, audio visualization, embedded player
  extension/   # Chrome Manifest V3 extension -- tab capture, sidebar injection
```

## Security

- API keys stored in `.env` only -- gitignored from commit zero
- All WebSocket messages validated with Zod schemas before processing
- CORS restricted to explicit origins
- Structured logging with no PII or secrets
- CSP headers on all responses
- See [SECURITY.md](SECURITY.md) for vulnerability reporting

## License

[MIT](LICENSE)
