import type { SessionUser } from "./api";

type Role = SessionUser["role"];

export type Permission =
  | "business.read"
  | "business.create"
  | "business.update"
  | "business.assign"
  | "authorization.manage"
  | "audit.read"
  | "masterdata.read"
  | "masterdata.write"
  | "transaction.read"
  | "transaction.write"
  | "invoice.read"
  | "invoice.write"
  | "invoice.approve"
  | "fbr.read"
  | "fbr.submit"
  | "fbr.manage"
  | "firm.settings";

const ADMIN: Permission[] = [
  "business.read",
  "business.create",
  "business.update",
  "business.assign",
  "authorization.manage",
  "audit.read",
  "masterdata.read",
  "masterdata.write",
  "transaction.read",
  "transaction.write",
  "invoice.read",
  "invoice.write",
  "invoice.approve",
  "fbr.read",
  "fbr.submit",
  "fbr.manage",
];

const MAP: Record<Role, Permission[]> = {
  owner: [...ADMIN, "firm.settings"],
  admin: ADMIN,
  staff: [
    "business.read",
    "business.create",
    "business.update",
    "authorization.manage",
    "masterdata.read",
    "masterdata.write",
    "transaction.read",
    "transaction.write",
    "invoice.read",
    "invoice.write",
    "fbr.read",
    "fbr.submit",
  ],
  viewer: [
    "business.read",
    "masterdata.read",
    "transaction.read",
    "invoice.read",
    "fbr.read",
  ],
};

export const can = (role: Role | undefined, p: Permission) =>
  !!role && MAP[role].includes(p);
