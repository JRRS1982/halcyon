import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { ChangePassword } from "@/app/(app)/settings/ChangePassword";
import {
  CHANGE_PASSWORD_MESSAGES,
  type ChangePasswordOutcome,
} from "@/lib/auth/changePasswordOutcome";
import { theme } from "@/lib/theme";

const changePassword = jest.fn(
  async (_input: unknown): Promise<ChangePasswordOutcome> => ({
    ok: true,
    othersSignedOut: true,
  }),
);
jest.mock("@/app/(app)/settings/credentialActions", () => ({
  changePassword: (input: unknown) => changePassword(input),
}));

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <ChangePassword />
    </ThemeProvider>,
  );

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/current password/i), {
    target: { value: "old-password-here" },
  });
  fireEvent.change(screen.getByLabelText(/new password/i), {
    target: { value: "a-long-enough-new-one" },
  });
  fireEvent.click(screen.getByRole("button", { name: /change password/i }));
};

describe("ChangePassword", () => {
  beforeEach(() => {
    changePassword.mockClear();
  });

  it("confirms when the password changed and other devices were signed out", async () => {
    renderit();
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /any other devices have been signed out/i,
      ),
    );
  });

  // The inverted ternary would swap success and warning without failing tests
  // that only check the happy path.
  it("shows a warning when the other devices could not be signed out", async () => {
    changePassword.mockResolvedValueOnce({ ok: true, othersSignedOut: false });
    renderit();
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /couldn't sign out your other devices/i,
      ),
    );
  });

  it("shows the action's reason when it refuses", async () => {
    changePassword.mockResolvedValueOnce({
      ok: false,
      reason: "wrong-password",
    });
    renderit();
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        CHANGE_PASSWORD_MESSAGES["wrong-password"],
      ),
    );
  });
});
