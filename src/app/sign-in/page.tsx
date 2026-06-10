import { SignInForm } from "@/components/auth/SignInForm";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignInPage(props: Props) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? "/";

  return <SignInForm next={next} error={searchParams.error} />;
}
