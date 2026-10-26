import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { authNotice } from "@/lib/auth/authNotices";

type Props = {
  searchParams: Promise<{ token_hash?: string; error?: string }>;
};

// Verifies nothing on load — see the action for why. The token only rides
// along in a hidden field until the user submits a new password.
export default async function ResetPasswordPage(props: Props) {
  const searchParams = await props.searchParams;

  return (
    <ResetPasswordForm
      tokenHash={searchParams.token_hash}
      error={authNotice(searchParams.error)}
    />
  );
}
