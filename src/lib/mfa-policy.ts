import type { Role } from "./authz";

export type AalLevel = "aal1" | "aal2";

export function privilegedRoleNeedsAal2(
  role: Role,
  currentLevel: AalLevel
): boolean {
  return (role === "admin" || role === "manager") && currentLevel !== "aal2";
}
