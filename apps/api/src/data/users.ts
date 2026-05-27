import type { User } from '@grain/types';

export const SEEDED_USERS: User[] = [
  {
    email: 'isathe@perforce.com',
    role: 'researcher',
    products: ['helix-core', 'p4v', 'helix-swarm'],
  },
  {
    email: 'pm@perforce.com',
    role: 'pm',
    products: ['helix-core'],
  },
];

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return SEEDED_USERS.find((u) => u.email.toLowerCase() === normalized);
}
