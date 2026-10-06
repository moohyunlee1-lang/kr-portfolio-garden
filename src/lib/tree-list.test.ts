import { describe, expect, it } from "vitest";
import { filterTreeList, treeListPage } from "./tree-list";
import type { Position } from "./types";

const position = (ticker: string, name: string, plotIndex: number) =>
  ({ id: ticker, ticker, name, plotIndex } as Position);

describe("current garden tree list", () => {
  const planted = [position("000660", "SK하이닉스", 2), position("005930", "삼성전자", 0), position("035420", "NAVER", 1)];

  it("keeps plot order and searches only names or tickers in this garden", () => {
    expect(filterTreeList(planted, "").map((tree) => tree.ticker)).toEqual(["005930", "035420", "000660"]);
    expect(filterTreeList(planted, "삼성").map((tree) => tree.ticker)).toEqual(["005930"]);
    expect(filterTreeList(planted, "660").map((tree) => tree.ticker)).toEqual(["000660"]);
    expect(filterTreeList(planted, "naver").map((tree) => tree.ticker)).toEqual(["035420"]);
  });

  it("renders bounded pages even in a 933-tree garden", () => {
    const all = Array.from({ length: 933 }, (_, index) => position(String(index), `나무 ${index}`, index));
    expect(treeListPage(all, 1).length).toBe(60);
    expect(treeListPage(all, 2).length).toBe(120);
    expect(treeListPage(all, 99).length).toBe(933);
  });
});