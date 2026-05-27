import type { Role } from '@grain/types';
import { PM_ROLE_PROMPT } from './pm.ts';
import { DESIGNER_ROLE_PROMPT } from './designer.ts';
import { ENGINEER_ROLE_PROMPT } from './engineer.ts';
import { RESEARCHER_ROLE_PROMPT } from './researcher.ts';

export const ROLE_PROMPTS: Record<Role, string> = {
  pm: PM_ROLE_PROMPT,
  designer: DESIGNER_ROLE_PROMPT,
  engineer: ENGINEER_ROLE_PROMPT,
  researcher: RESEARCHER_ROLE_PROMPT,
};

export { PM_ROLE_PROMPT, PM_FORBIDDEN } from './pm.ts';
export { DESIGNER_ROLE_PROMPT, DESIGNER_FORBIDDEN } from './designer.ts';
export { ENGINEER_ROLE_PROMPT, ENGINEER_FORBIDDEN } from './engineer.ts';
export { RESEARCHER_ROLE_PROMPT, RESEARCHER_FORBIDDEN } from './researcher.ts';
