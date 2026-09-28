import { GardenView } from "@/components/garden-view";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GardenPage({
  params,
  searchParams,
}: {
  params: Promise<{ gardenId: string }>;
  searchParams: Promise<{ focus?: string | string[]; merged?: string | string[] }>;
}) {
  const { gardenId } = await params;
  const query = await searchParams;
  return (
    <GardenView
      gardenId={gardenId}
      focusId={one(query.focus)}
      merged={one(query.merged) === "1"}
    />
  );
}
