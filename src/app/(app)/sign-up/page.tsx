import { SignUpForm } from "@/components/auth/SignUpForm";
import { authNotice } from "@/lib/auth/authNotices";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function SignUpPage(props: Props) {
  const searchParams = await props.searchParams;

  return (
    <SignUpForm
      error={authNotice(searchParams.error)}
      success={searchParams.success}
    />
  );
}
