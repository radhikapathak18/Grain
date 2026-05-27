const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
// Default to PATH-resolved `claude`. Override with the CLAUDE_BIN env var
// if the binary lives outside PATH (e.g. inside the VS Code extension
// resources directory). Spawn will surface a clear ENOENT on the first
// chat request if the binary cannot be resolved.
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
const MODEL = process.env.GRAIN_MODEL ?? 'sonnet';

export const env = { PORT, WEB_ORIGIN, CLAUDE_BIN, MODEL } as const;
