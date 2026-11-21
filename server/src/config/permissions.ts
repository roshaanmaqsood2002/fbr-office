import { Role } from '../models/User';

export type Permission =
  | 'business.read' | 'business.create' | 'business.update' | 'business.assign'
  | 'authorization.manage' | 'audit.read'
  | 'masterdata.read' | 'masterdata.write'
  | 'transaction.read' | 'transaction.write'
  | 'invoice.read' | 'invoice.write' | 'invoice.approve'
  | 'fbr.read' | 'fbr.submit' | 'fbr.manage'
  | 'firm.settings';

const ADMIN: Permission[] = [
  'business.read', 'business.create', 'business.update', 'business.assign',
  'authorization.manage', 'audit.read',
  'masterdata.read', 'masterdata.write', 'transaction.read', 'transaction.write',
  'invoice.read', 'invoice.write', 'invoice.approve',
  'fbr.read', 'fbr.submit', 'fbr.manage',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...ADMIN, 'firm.settings'],
  admin: ADMIN,
  staff: [
    'business.read', 'business.create', 'business.update', 'authorization.manage',
    'masterdata.read', 'masterdata.write', 'transaction.read', 'transaction.write',
    'invoice.read', 'invoice.write', 'fbr.read', 'fbr.submit',
  ],
  viewer: ['business.read', 'masterdata.read', 'transaction.read', 'invoice.read', 'fbr.read'],
};

export const can = (role: Role, p: Permission) => ROLE_PERMISSIONS[role].includes(p);
export const isFirmWide = (role: Role) => role === 'owner' || role === 'admin';