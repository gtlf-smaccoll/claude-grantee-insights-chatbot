import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullGrantRecords } from "@/lib/google-sheets";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const grants = await getFullGrantRecords();
    const grant = grants.find((g) => g.reference_number === params.id);

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    return NextResponse.json(grant);
  } catch (error) {
    console.error("Failed to fetch grant:", error);
    return NextResponse.json(
      { error: "Failed to fetch grant data" },
      { status: 500 }
    );
  }
}
