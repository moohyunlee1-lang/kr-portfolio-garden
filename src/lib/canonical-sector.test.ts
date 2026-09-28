import { describe, expect, it } from "vitest";
import { canonicalSector } from "./canonical-sector";

describe("canonicalSector", () => {
  it("keeps Samsung Electronics in semiconductors, not bio", () => {
    expect(
      canonicalSector("005930", [
        "바이오 · 17 지주·간접노출",
        "로봇 · 04 서비스·가정·교육",
        "자동차 · 09 차량 반도체·PCB·디스플레이",
      ]),
    ).toBe("반도체");
  });

  it("skips 지분·간접 gardens when a core chain exists", () => {
    expect(
      canonicalSector("005380", ["로봇 · 13 간접·지분 및 확인보류", "자동차 · 01 완성차·특장차"]),
    ).toBe("자동차");
  });

  it("puts SK hynix in semiconductors even if only listed under auto", () => {
    expect(canonicalSector("000660", ["자동차 · 09 차량 반도체·PCB·디스플레이"])).toBe("반도체");
  });

  it("puts Samsung SDI in batteries rather than semiconductor materials", () => {
    expect(
      canonicalSector("006400", [
        "반도체 · 05 후공정 소부장",
        "2차전지 · 01 셀·완성전지",
        "자동차 · 10 차량용 배터리·팩·BMS",
      ]),
    ).toBe("2차전지");
  });
});
