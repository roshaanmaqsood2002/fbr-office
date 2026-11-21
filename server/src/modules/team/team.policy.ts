
import type { Role } from '../../models/User';

const RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  staff: 2,
  viewer: 1,
};

const ASSIGNABLE_BY: Record<Role, Role[]> = {
  owner: ['admin', 'staff', 'viewer'],
  admin: ['staff', 'viewer'],
  staff: [],
  viewer: [],
};

export const canAssign = (actor: Role, role: Role): boolean =>
  ASSIGNABLE_BY[actor].includes(role);

export const canManage = (actor: Role, target: Role): boolean =>
  RANK[actor] > RANK[target];
