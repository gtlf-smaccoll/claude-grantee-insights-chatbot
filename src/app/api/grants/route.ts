import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGrantRegistry } from "@/lib/google-sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const registry = await getGrantRegistry();
    return NextResponse.json(registry);
  } catch (error) {
    console.error("Failed to fetch grant registry:", error);
    return NextResponse.json(
      { error: "Failed to fetch grant data" },
      { status: 500 }
    );
  }
}
