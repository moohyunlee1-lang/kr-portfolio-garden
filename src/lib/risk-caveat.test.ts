import { describe, expect, it } from "vitest";
import { riskGardenNotice, riskPositionNotice } from "./risk-caveat";

describe("historical risk garden caveat", () => {
  it("labels retrospective selection and hypothetical positions on every viewport", () => {
    const text = riskGardenNotice("kosdaq_delisting_risk");
    expect(text).toContain("2026-10-06");
    expect(text).toContain("2026-09-01");
    expect(text).toContain("가상");
    expect(riskGardenNotice("cross_watch")).toBeNull();
  });
  it("flags a position designated only after the planting reference date", () => {
    expect(riskPositionNotice("kosdaq_delisting_risk", "058450")).toContain("식재일 이후");
    expect(riskPositionNotice("kosdaq_delisting_risk", "032685")).not.toContain("식재일 이후");
    expect(riskPositionNotice("cross_watch", "058450")).toBeNull();
  });
});
