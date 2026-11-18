import { AiError } from "@/lib/server/llm";
import { explain, find, hint, recap, rewrite, talk } from "@/lib/server/tasks";

const TASKS = { explain, find, talk, rewrite, hint, recap } as const;
type Task = keyof typeof TASKS;

export async function POST(request: Request) {
  let body: { task?: string; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const task = body.task as Task;
  if (!task || !(task in TASKS)) {
    return Response.json({ error: "Unknown task." }, { status: 400 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (TASKS[task] as (input: any) => Promise<unknown>)(body.input ?? {});
    return Response.json(result);
  } catch (err) {
    const status = err instanceof AiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status });
  }
}
