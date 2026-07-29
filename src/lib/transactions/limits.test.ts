import nextConfig from "../../../next.config.mjs";
import { MAX_IMPORT_FILE_MB, MAX_IMPORT_ROWS, importLimitHint } from "./limits";

describe("import limits", () => {
  // The client rejects files over MAX_IMPORT_FILE_BYTES, but the server action
  // only ever sees a request body. If bodySizeLimit were lower, a file inside the
  // advertised limit would still fail with an opaque body-size error.
  it("keeps the server action body limit in step with the file cap", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(
      `${MAX_IMPORT_FILE_MB}mb`,
    );
  });

  it("advertises both limits in the hint shown next to the picker", () => {
    expect(importLimitHint).toContain(MAX_IMPORT_ROWS.toLocaleString());
    expect(importLimitHint).toContain(`${MAX_IMPORT_FILE_MB}MB`);
  });
});
