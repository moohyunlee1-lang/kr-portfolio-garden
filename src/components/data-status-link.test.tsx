// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DataStatusLink } from "./data-status-link";
afterEach(cleanup);
it("links a stock directly to its evidence search, not a local path", () => {
  render(<DataStatusLink ticker="005930" />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/data-status?ticker=005930');
  expect(screen.getByText(/가격 시점 미상/)).toBeTruthy();
});
it("rejects non-code navigation input", () => {
  render(<DataStatusLink ticker="../../secret" />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/data-status');
});
