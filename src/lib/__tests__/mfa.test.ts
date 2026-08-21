import { describe, expect, it } from "vitest";
import { privilegedRoleNeedsAal2 } from "../mfa-policy";

describe("privileged MFA decision", () => {
  it("requires AAL2 for admin and manager mutation sessions", () => {
    expect(privilegedRoleNeedsAal2("admin", "aal1")).toBe(true);
    expect(privilegedRoleNeedsAal2("manager", "aal1")).toBe(true);
  });

  it("does not require AAL2 for viewers or already-verified sessions", () => {
    expect(privilegedRoleNeedsAal2("viewer", "aal1")).toBe(false);
    expect(privilegedRoleNeedsAal2("admin", "aal2")).toBe(false);
    expect(privilegedRoleNeedsAal2("manager", "aal2")).toBe(false);
  });
});
