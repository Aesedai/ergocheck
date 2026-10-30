export const ROLES = ['member', 'org_admin'] as const;
export type Role = (typeof ROLES)[number];
