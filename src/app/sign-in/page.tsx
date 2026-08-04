import { SignInForm } from "@/components/auth/SignInForm";

// Set by the proxy's expiry redirect and by the client-side idle timer. Looking
// the reason up in a fixed table means an arbitrary `?timeout=` value renders
// nothing rather than being echoed back to the page.
const TIMEOUT_NOTICES: Record<string, string> = {
  idle: "You were signed out after a period of inactivity.",
  absolute: "You were signed out because your session reached its time limit.",
};

type Props = {
  searchParams: Promise<{ error?: string; next?: string; timeout?: string }>;
};

export default async function SignInPage(props: Props) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? "/";
  const notice = searchParams.timeout
    ? TIMEOUT_NOTICES[searchParams.timeout]
    : undefined;

  return <SignInForm next={next} error={searchParams.error} notice={notice} />;
}
