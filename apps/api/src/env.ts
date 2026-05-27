const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const CLAUDE_BIN =
  process.env.CLAUDE_BIN ??
  '/Users/isathe/.vscode/extensions/anthropic.claude-code-2.1.145-darwin-arm64/resources/native-binary/claude';
const MODEL = process.env.GRAIN_MODEL ?? 'sonnet';

export const env = { PORT, WEB_ORIGIN, CLAUDE_BIN, MODEL } as const;
