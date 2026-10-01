import { log } from "@/lib/log";

describe("log", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("routes each level to the matching console method", () => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => {});
    const info = jest.spyOn(console, "info").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    expect(debug).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  describe("development output (NODE_ENV !== production)", () => {
    it("formats a plain message without meta", () => {
      const info = jest.spyOn(console, "info").mockImplementation(() => {});
      log.info("hello");
      expect(info).toHaveBeenCalledWith("[info] hello");
    });

    it("passes meta as a second argument", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      log.warn("careful", { userId: "u1" });
      expect(warn).toHaveBeenCalledWith("[warn] careful", { userId: "u1" });
    });

    it("expands an Error in meta into name/message/stack", () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      log.error("failed", { err: new Error("boom") });
      expect(error).toHaveBeenCalledWith("[error] failed", {
        err: expect.objectContaining({
          name: "Error",
          message: "boom",
          stack: expect.any(String),
        }),
      });
    });
  });

  describe("production output (NODE_ENV === production)", () => {
    // Next types NODE_ENV as read-only, so reach the var through a mutable view.
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;

    beforeEach(() => {
      env.NODE_ENV = "production";
    });

    afterEach(() => {
      env.NODE_ENV = originalEnv;
    });

    it("emits a single JSON line with level, message, time and meta", () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      log.error("kaboom", { code: 500 });

      expect(error).toHaveBeenCalledTimes(1);
      const line = error.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(line);
      expect(parsed).toMatchObject({
        level: "error",
        message: "kaboom",
        code: 500,
      });
      expect(typeof parsed.time).toBe("string");
    });
  });
});
