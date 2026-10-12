// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataStatusView } from "./data-status-view";
import manifest from "../data/data-status.v1.json";
afterEach(cleanup);
it("navigates recorded membership without inventing supply-chain edges", () => {
  const sample = { ...manifest, entities: { "005930": { ...manifest.entities["005930"], memberships:[{gardenId:"vc_test_01",label:"시험 소재",recordPointer:"/0/positions/0"}] } } };
  render(<DataStatusView manifest={sample} now="2026-10-12T12:00:00+09:00" initialQuery="005930" />);
  fireEvent.click(screen.getByRole("button",{name:"삼성전자 005930 근거 보기"}));
  expect(screen.getByRole("link",{name:"시험 소재 정원"}).getAttribute("href")).toBe("/garden/vc_test_01");
  expect(screen.getByText(/JSON Pointer: \/0\/positions\/0/)).toBeTruthy();
  expect(screen.getAllByText(/공급·고객 관계가 아닙니다/).length).toBeGreaterThan(0);
});
it("exposes partial stale signals, source hashes and exact disclosure navigation", () => {
  render(<DataStatusView manifest={manifest} now="2026-10-12T12:00:00+09:00" initialQuery="005930" />);
  fireEvent.change(screen.getByLabelText("기대 시장 기준일 (운영자 확인)"),{target:{value:"2026-10-12"}});
  expect(screen.getByText(/거래소 달력 자동 확인 아님/)).toBeTruthy();
  expect(screen.getByRole("heading",{name:"데이터 상태 / 근거"})).toBeTruthy();
  expect(screen.getAllByText(/partial · 부분/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/stale · 오래됨/).length).toBeGreaterThan(0);
  expect(screen.getByText(/missing · 없음/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"삼성전자 005930 근거 보기"}));
  expect(screen.getAllByText(/가격 시각 미제공/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/원문/).length).toBeGreaterThan(0);
  const source=screen.getAllByRole("link").find(x=>x.getAttribute('href')?.includes('rcpNo='));
  expect(source?.getAttribute('href')).toMatch(/^https:\/\/dart.fss.or.kr\/dsaf001\/main.do\?rcpNo=\d{14}$/);
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'NOT_PRESENT'}});
  expect(screen.getByText('검색 결과 없음')).toBeTruthy();
});
