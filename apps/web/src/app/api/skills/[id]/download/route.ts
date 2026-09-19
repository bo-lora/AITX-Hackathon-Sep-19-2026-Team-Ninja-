import { NextResponse } from "next/server";
import { getSkill } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const skill = await getSkill(id);
  if (!skill) {
    return NextResponse.json({ error: "No skill with that id." }, { status: 404 });
  }

  const filename = `${skill.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "skill"}.md`;
  return new NextResponse(skill.grokSkill, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
