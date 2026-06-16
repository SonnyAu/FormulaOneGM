"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { DriverMarketScreen } from "@/components/offseason/DriverMarketScreen";

function ReSignDriversWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Re-sign Drivers" subtitle="Retain expiring contracts">
      {saveId ? <DriverMarketScreen saveId={saveId} mode="resign" /> : null}
    </ManagementFrame>
  );
}

export default function ReSignDriversPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <ReSignDriversWithSaveId />
    </Suspense>
  );
}
