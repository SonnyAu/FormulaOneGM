"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { DriverMarketScreen } from "@/components/offseason/DriverMarketScreen";

function FreeAgentsWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Free Agent Drivers" subtitle="Fill open seats">
      {saveId ? <DriverMarketScreen saveId={saveId} mode="free-agent" /> : null}
    </ManagementFrame>
  );
}

export default function FreeAgentsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <FreeAgentsWithSaveId />
    </Suspense>
  );
}
