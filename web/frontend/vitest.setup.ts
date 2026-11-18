import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  // @ts-expect-error - assigning webcrypto for test environment
  globalThis.crypto = webcrypto;
}
