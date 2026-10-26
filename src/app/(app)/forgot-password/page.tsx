import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { authNotice } from "@/lib/auth/authNotices";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function ForgotPasswordPage(props: Props) {
  const searchParams = await props.searchParams;

  return (
    <ForgotPasswordForm
      error={authNotice(searchParams.error)}
      isSent={searchParams.success !== undefined}
    />
  );
}
