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
// the project dashboard) which is the authoritative server-side check.
export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
