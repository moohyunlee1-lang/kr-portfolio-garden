import { PositionCard } from "@/components/position-card";

export default async function PositionPage({
  params,
}: {
  params: Promise<{ gardenId: string; positionId: string }>;
}) {
  const { gardenId, positionId } = await params;
  return <PositionCard gardenId={gardenId} positionId={positionId} />;
}
