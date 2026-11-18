import { connection } from "next/server";
import { aiConfig } from "@/lib/server/llm";

export async function GET() {
  await connection(); // read the env at request time, not build time
  return Response.json({ ai: aiConfig() });
}
