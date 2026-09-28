import { PlantForm } from "@/components/plant-form";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewPlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ gardenId: string }>;
  searchParams: Promise<{ plot?: string | string[] }>;
}) {
  const { gardenId } = await params;
  const query = await searchParams;
  const plot = Number(one(query.plot));
  return <PlantForm gardenId={gardenId} plotIndex={Number.isInteger(plot) ? plot : undefined} />;
}
