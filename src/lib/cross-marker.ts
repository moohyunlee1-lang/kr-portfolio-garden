import type { CrossMark } from "./cross-seed";

export function crossMarkerAppearance(mark: CrossMark | null): { shape: "star" | "skull"; color: string } | null {
  if (mark === "golden") return { shape: "star", color: "#ffd34a" };
  if (mark === "dead") return { shape: "skull", color: "#eee8df" };
  return null;
}
