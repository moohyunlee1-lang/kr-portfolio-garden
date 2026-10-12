import { DataStatusView } from "../../components/data-status-view";
import manifest from "../../data/data-status.v1.json";

// Assess at request time, not deployment time. No collector runs from this route.
export const dynamic = "force-dynamic";
export default async function DataStatusPage({ searchParams }: { searchParams: Promise<{ ticker?: string }> }) {
  const { ticker } = await searchParams;
  return <DataStatusView manifest={manifest} now={new Date().toISOString()} initialQuery={typeof ticker === "string" && /^[0-9A-Z]{6}$/.test(ticker) ? ticker : ""} />;
}
