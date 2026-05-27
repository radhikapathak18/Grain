import type { SourceDocument } from './gong-001.ts';
import { GONG_001 } from './gong-001.ts';
import { GONG_002 } from './gong-002.ts';
import { SLACK_001 } from './slack-001.ts';
import { CONFLUENCE_001 } from './confluence-001.ts';
import { PENDO_001 } from './pendo-001.ts';
import { ZOOM_001 } from './zoom-001.ts';

export type { SourceDocument };

export const SOURCES: SourceDocument[] = [
  GONG_001,
  GONG_002,
  SLACK_001,
  CONFLUENCE_001,
  PENDO_001,
  ZOOM_001,
];

export const SOURCE_BY_ID: Record<string, SourceDocument> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

export { GONG_001, GONG_002, SLACK_001, CONFLUENCE_001, PENDO_001, ZOOM_001 };
