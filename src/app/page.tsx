"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BootScreen } from "@/components/boot";
import { useGardens } from "@/components/garden-context";

export default function HomePage() {
  const router = useRouter();
  const { ready, entryId } = useGardens();

  useEffect(() => {
    if (ready && entryId) router.replace(`/garden/${entryId}`);
  }, [ready, entryId, router]);

  return <BootScreen />;
}
