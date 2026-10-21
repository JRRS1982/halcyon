import { z } from "zod";

// Sign-in only checks that something was submitted. We don't enforce password
// rules at this boundary — Supabase will reject mismatches and we don't want
// to lock existing users out by tightening rules retroactively.
export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Sign-up enforces a minimum password length client-side so users get a clear
// error before the network round-trip. Supabase has its own minimum (set in
// the project dashboard) which is the authoritative server-side check — this
// schema runs server-side too, so the two are belt and braces rather than
// this one being advisory.
//
// Twelve, not eight. Eight has not been a meaningful floor for years, and the
// Sep 2026 audit already identified the bump as the free half of the password
// finding. The other half is checkPasswordBreach, consulted in the sign-up and
// change-password actions: length alone does nothing about "Password1234",
// which is long, compliant and in every breach corpus there is.
//
// Shared by both schemas below, so the floor and the breach check cover the
// two ways a password is ever set.
const newPassword = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200, "Password must be at most 200 characters");

export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: newPassword,
});

// Changing the password from Settings. The current password is the step-up
// proof (verifyUser), so like sign-in it only has to be present; the new
// password meets the sign-up rule, so the floor cannot be stepped around by
// signing up with a long password and changing it to a short one.
//
// The breach half of that rule lives in the action, not here: it is a network
// call, and a schema that reached out to HiBP would make every parse of it —
// including the client's — an outbound request.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword,
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    message: "Choose a password you aren't already using",
    path: ["newPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
