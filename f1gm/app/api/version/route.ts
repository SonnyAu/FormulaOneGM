import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/buildInfo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(getBuildInfo(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
