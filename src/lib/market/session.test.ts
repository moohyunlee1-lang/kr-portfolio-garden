import { describe, expect, it } from "vitest";
import { inKrxHours, RANK_POLL_MS, shouldPoll } from "./session";

function kst(iso: string): Date {
  return new Date(iso);
}

describe("inKrxHours", () => {
  it("is open on a weekday morning in Seoul", () => {
    expect(inKrxHours(kst("2026-09-29T00:10:00.000Z"))).toBe(true);
  });

  it("is closed before the 08:50 buffer", () => {
    expect(inKrxHours(kst("2026-09-28T23:40:00.000Z"))).toBe(false);
  });

  it("is closed after 16:00 KST", () => {
    expect(inKrxHours(kst("2026-09-29T07:10:00.000Z"))).toBe(false);
  });

  it("is closed on Saturday", () => {
    expect(inKrxHours(kst("2026-09-26T01:00:00.000Z"))).toBe(false);
  });
});

describe("shouldPoll", () => {
  it("does not poll when the tab is hidden", () => {
    expect(shouldPoll(kst("2026-09-29T01:00:00.000Z"), true)).toBe(false);
  });

  it("polls when visible during the session", () => {
    expect(shouldPoll(kst("2026-09-29T01:00:00.000Z"), false)).toBe(true);
  });
});

describe("RANK_POLL_MS", () => {
  it("is ten minutes", () => {
    expect(RANK_POLL_MS).toBe(10 * 60 * 1000);
  });
});
