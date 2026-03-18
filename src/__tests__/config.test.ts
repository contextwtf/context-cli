import { describe, test, expect } from "bun:test";
import { parseEnvFile, serializeEnvFile } from "../config.js";

describe("config", () => {
  describe("parseEnvFile", () => {
    test("parses KEY=VALUE lines", () => {
      const input = 'CONTEXT_API_KEY=abc123\nCONTEXT_PRIVATE_KEY=0xdeadbeef\n';
      const result = parseEnvFile(input);
      expect(result).toEqual({
        CONTEXT_API_KEY: "abc123",
        CONTEXT_PRIVATE_KEY: "0xdeadbeef",
      });
    });

    test("handles quoted values", () => {
      const input = 'CONTEXT_API_KEY="abc 123"\n';
      const result = parseEnvFile(input);
      expect(result).toEqual({ CONTEXT_API_KEY: "abc 123" });
    });

    test("skips comments and blank lines", () => {
      const input = '# comment\n\nCONTEXT_API_KEY=abc\n';
      const result = parseEnvFile(input);
      expect(result).toEqual({ CONTEXT_API_KEY: "abc" });
    });

    test("returns empty object for empty input", () => {
      expect(parseEnvFile("")).toEqual({});
    });
  });

  describe("serializeEnvFile", () => {
    test("serializes key-value pairs", () => {
      const result = serializeEnvFile({
        CONTEXT_API_KEY: "abc",
        CONTEXT_PRIVATE_KEY: "0xdead",
      });
      expect(result).toBe('CONTEXT_API_KEY="abc"\nCONTEXT_PRIVATE_KEY="0xdead"\n');
    });
  });
});
