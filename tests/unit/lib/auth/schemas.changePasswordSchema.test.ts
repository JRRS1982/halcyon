import { changePasswordSchema } from "@/lib/auth/schemas";

const valid = {
  currentPassword: "old-password-here",
  newPassword: "a-long-enough-new-one",
};

// The floor sign-up enforces, applied at the other end. Without it an account
// could be opened with a compliant password and then changed to a short one
// from Settings, which is the same account with none of the protection.
describe("changePasswordSchema", () => {
  it("accepts a current password and a long enough new one", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("holds the new password to sign-up's twelve characters", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: "elevenchars",
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result, "newPassword")).toContain(
      "Password must be at least 12 characters",
    );
  });

  it("accepts exactly twelve, the boundary sign-up allows", () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, newPassword: "twelvechars!" })
        .success,
    ).toBe(true);
  });

  it("rejects a new password over 200 characters", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: "x".repeat(201),
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result, "newPassword")).toContain(
      "Password must be at most 200 characters",
    );
  });

  // Saving your own password back is a no-op the user would read as a change,
  // which is worse than being told it isn't one.
  it("refuses a new password identical to the current one", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "a-long-enough-new-one",
      newPassword: "a-long-enough-new-one",
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result, "newPassword")).toContain(
      "Choose a password you aren't already using",
    );
  });

  // The current password is the step-up proof, not a password being set, so
  // it is only required to be present — the same reasoning as signInSchema.
  it("requires the current password to be present", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      currentPassword: "",
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result, "currentPassword")).toContain(
      "Enter your current password",
    );
  });
});

function messagesFor(
  result: ReturnType<typeof changePasswordSchema.safeParse>,
  field: string,
): string[] {
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}
