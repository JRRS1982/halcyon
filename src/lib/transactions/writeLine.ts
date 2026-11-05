// The "write a line" box on the transactions page: a transaction typed the way
// it would be jotted on paper ("4.35 Pret coffee", "+2,850 Salary",
// "12/10 30 Fuel"), read into the fields of the add form. The form still opens
// for the user to check before anything is saved.

export type WrittenLine = {
  amount: number;
  direction: "in" | "out";
  description: string;
  // YYYY-MM-DD.
  date: string;
};

const AMOUNT = /^([+-])?£?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;
const DAY_MONTH = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function dateFrom(token: string, today: Date): string | null {
  const word = token.toLowerCase();
  if (word === "today") return isoDate(today);
  if (word === "yesterday") {
    return isoDate(new Date(today.getTime() - 24 * 60 * 60 * 1000));
  }
  const match = DAY_MONTH.exec(token);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : today.getUTCFullYear();
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects 31/02 and the like, which Date would quietly roll forward.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return isoDate(date);
}

/** Reads a jotted line into an amount, direction, description and date. */
export function parseLine(text: string, today: Date): WrittenLine | null {
  let amount: number | null = null;
  let direction: WrittenLine["direction"] = "out";
  let date: string | null = null;
  const words: string[] = [];

  for (const token of text.trim().split(/\s+/)) {
    const money: RegExpExecArray | null =
      amount === null ? AMOUNT.exec(token) : null;
    if (money) {
      amount = Number(
        `${(money[2] ?? "").replace(/,/g, "")}.${money[3] ?? "0"}`,
      );
      direction = money[1] === "+" ? "in" : "out";
      continue;
    }
    const day: string | null = date === null ? dateFrom(token, today) : null;
    if (day) {
      date = day;
      continue;
    }
    words.push(token);
  }

  const description = words.join(" ");
  if (amount === null || amount <= 0 || description === "") return null;
  return { amount, direction, description, date: date ?? isoDate(today) };
}
