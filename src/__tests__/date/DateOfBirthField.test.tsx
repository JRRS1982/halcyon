import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { DateOfBirthField } from "@/components/ui/DateOfBirthField";
import { theme } from "@/lib/theme";

const renderField = (value = "", onCommit = jest.fn()) => {
  const utils = render(
    <ThemeProvider theme={theme}>
      <DateOfBirthField
        legend="Date of birth"
        value={value}
        onCommit={onCommit}
      />
    </ThemeProvider>,
  );
  return { ...utils, onCommit };
};

const fields = () => ({
  day: screen.getByLabelText("Day"),
  month: screen.getByLabelText("Month"),
  year: screen.getByLabelText("Year"),
});

describe("DateOfBirthField", () => {
  test("shows a stored date split across three fields", () => {
    renderField("1986-06-01");
    const { day, month, year } = fields();
    expect(day).toHaveValue("01");
    expect(month).toHaveValue("06");
    expect(year).toHaveValue("1986");
  });

  test("hands up a stored date once all three fields are filled", () => {
    const { onCommit } = renderField("");
    const { day, month, year } = fields();
    fireEvent.change(day, { target: { value: "1" } });
    fireEvent.change(month, { target: { value: "6" } });
    fireEvent.change(year, { target: { value: "1986" } });
    expect(onCommit).toHaveBeenLastCalledWith("1986-06-01");
  });

  // "" is what leaves "Create my plan" disabled and stops a half-typed date
  // reaching the server.
  test('hands up "" while the date is incomplete', () => {
    const { onCommit } = renderField("");
    const { day, month } = fields();
    fireEvent.change(day, { target: { value: "01" } });
    fireEvent.change(month, { target: { value: "06" } });
    expect(onCommit).toHaveBeenLastCalledWith("");
  });

  test('hands up "" for a day that does not exist in that month', () => {
    const { onCommit } = renderField("");
    const { day, month, year } = fields();
    fireEvent.change(day, { target: { value: "31" } });
    fireEvent.change(month, { target: { value: "02" } });
    fireEvent.change(year, { target: { value: "1986" } });
    expect(onCommit).toHaveBeenLastCalledWith("");
  });

  test("ignores anything that is not a digit, and caps each field", () => {
    renderField("");
    const { day, year } = fields();
    fireEvent.change(day, { target: { value: "a1x" } });
    expect(day).toHaveValue("1");
    fireEvent.change(year, { target: { value: "19867" } });
    expect(year).toHaveValue("1986");
  });

  // The assumptions panel saves to the server and re-renders with whatever it
  // last committed, which arrives a save behind. Adopting that echo mid-edit
  // would delete what has been typed since — the same defect the ledger's
  // search box had.
  test("keeps what is being typed when the parent re-renders with its own echo", () => {
    const onCommit = jest.fn();
    const { rerender } = renderField("", onCommit);
    const { day, month, year } = fields();
    fireEvent.change(day, { target: { value: "01" } });
    fireEvent.change(month, { target: { value: "06" } });
    fireEvent.change(year, { target: { value: "1986" } });

    // The server answers with the date we just sent, while the user is already
    // correcting the day — so the day field has focus, which is what tells the
    // component the fields are the truth.
    day.focus();
    fireEvent.change(day, { target: { value: "02" } });
    rerender(
      <ThemeProvider theme={theme}>
        <DateOfBirthField
          legend="Date of birth"
          value="1986-06-01"
          onCommit={onCommit}
        />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText("Day")).toHaveValue("02");
  });

  test("still adopts a genuinely new value from outside", () => {
    const onCommit = jest.fn();
    const { rerender } = renderField("1986-06-01", onCommit);
    rerender(
      <ThemeProvider theme={theme}>
        <DateOfBirthField
          legend="Date of birth"
          value="1990-12-25"
          onCommit={onCommit}
        />
      </ThemeProvider>,
    );
    const { day, month, year } = fields();
    expect(day).toHaveValue("25");
    expect(month).toHaveValue("12");
    expect(year).toHaveValue("1990");
  });
  test("the calendar button opens the picker rather than showing an input", () => {
    renderField("1986-06-01");
    const button = screen.getByRole("button", {
      name: "Choose the date from a calendar",
    });
    const showPicker = jest.fn();
    // jsdom has no showPicker; stub it on the prototype the hidden input uses.
    (
      HTMLInputElement.prototype as unknown as { showPicker: () => void }
    ).showPicker = showPicker;
    fireEvent.click(button);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  test("a date chosen from the calendar fills the three fields", () => {
    const { onCommit } = renderField("");
    // The hidden input is the calendar's own; picking a date fires its change.
    const hidden =
      document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(hidden).not.toBeNull();
    fireEvent.change(hidden as HTMLInputElement, {
      target: { value: "1990-12-25" },
    });
    expect(onCommit).toHaveBeenLastCalledWith("1990-12-25");
    expect(screen.getByLabelText("Day")).toHaveValue("25");
    expect(screen.getByLabelText("Month")).toHaveValue("12");
    expect(screen.getByLabelText("Year")).toHaveValue("1990");
  });
});
