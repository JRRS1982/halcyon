// Minimal RFC-4180-ish CSV parser. Bank exports vary wildly, so it handles
// quoted fields, commas and newlines inside quotes, doubled-quote escapes
// (""), and both LF and CRLF line endings. Cells are returned verbatim (no
// trimming) — downstream parsing (amount/date/description) does its own
// normalization. Fully-blank rows are dropped so trailing newlines and noise
// lines don't become empty records.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (!row.every((cell) => cell.trim() === "")) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) endRow();

  return rows;
}
