import { sizeScale } from "./garden-math";
import { isYtdGarden, ytdSizeScale } from "./ytd-size";

export function sceneScale(gardenId: string, lastPrice: number, marketValue: number, maxValue: number,
  quote?: { yearFirstDate?: string | null; yearFirstClose?: number | null }): number {
  return isYtdGarden(gardenId) ? ytdSizeScale(lastPrice, quote) : sizeScale(marketValue, maxValue);
}
