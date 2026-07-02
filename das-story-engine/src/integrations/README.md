# Integrations — the plug-board

Future APIs (Gemini video analysis, YouTube data pull, ElevenLabs dialogue reads)
each become **one new file here + one tool registration** — no rewiring.

An adapter exposes three things:

```ts
export interface Integration {
  name: string;                       // e.g. 'youtube'
  secrets: string[];                  // env vars it needs, e.g. ['YOUTUBE_API_KEY']
  register(server: McpServer): void;  // adds its tools
}
```

Empty by design until Phase 7 of the architecture plan.
