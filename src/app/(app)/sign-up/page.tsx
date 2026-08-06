import { SignUpForm } from "@/components/auth/SignUpForm";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function SignUpPage(props: Props) {
  const searchParams = await props.searchParams;

  return (
    <SignUpForm error={searchParams.error} success={searchParams.success} />
  );
}
