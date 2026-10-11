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
// finding. The other half is checkPasswordBreach, consulted in the sign-up
// action: length alone does nothing about "Password1234", which is long,
// compliant and in every breach corpus there is.
export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
