import { NextResponse } from "next/server";
import { listSkills } from "@/lib/store";

export async function GET() {
  const skills = await listSkills();
  return NextResponse.json({ skills });
}
