import { NextResponse } from "next/server";
import { getSkill, publishSkill } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const skill = await getSkill(id);
  if (!skill) {
    return NextResponse.json({ error: "No skill with that id." }, { status: 404 });
  }
  return NextResponse.json(skill);
}

export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const skill = await publishSkill(id);
  if (!skill) {
    return NextResponse.json({ error: "No skill with that id." }, { status: 404 });
  }
  return NextResponse.json(skill);
}
