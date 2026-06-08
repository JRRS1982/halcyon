import { LandingPage } from "@/components/marketing/LandingPage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in users have full app nav; the marketing page is for prospects.
  if (user) redirect("/dashboard");

  return <LandingPage />;
}
