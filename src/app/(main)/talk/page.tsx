"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { SCENES, TOPICS } from "@/lib/scenes";

const TINTS = ["#F1E6D8", "#E7ECFF", "#ECE8FB", "#E3EEDF", "#FFE9D6", "#E6F1F4"];

export default function TalkPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const progress = useLiveQuery(() => db.sceneProgress.toArray(), []);

  const covered = (id: string) => progress?.find((p) => p.sceneId === id)?.covered.length ?? 0;
  const recommended =
    [...SCENES].sort((a, b) => covered(a.id) / a.twists.length - covered(b.id) / b.twists.length)[0] ?? SCENES[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[32px] leading-10 font-semibold tracking-tight">Talk</h1>
          <p className="m-0 text-[15px]" style={{ color: "var(--muted)" }}>
            Real output: an American partner at native speed. Ask for a more native version whenever you want one.
          </p>
        </div>
        <Link href={`/talk/live?scene=${recommended.id}`} className="btn btn-primary min-h-12 px-6 text-base">
          Continue: {recommended.title}
        </Link>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow m-0">Scenes</h2>
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
          {SCENES.map((s, i) => (
            <Link
              key={s.id}
              href={`/talk/scene/${s.id}`}
              className="card flex flex-col gap-3 p-5 no-underline transition-shadow hover:shadow-md"
              style={{ color: "var(--ink)" }}
            >
              <div
                aria-hidden="true"
                className="flex h-20 items-end rounded-2xl px-4 pb-3 text-[13px] font-medium"
                style={{ background: TINTS[i % TINTS.length], color: "#4A4A4F" }}
              >
                {s.setting}
              </div>
              <div className="flex flex-col gap-1">
                <p className="m-0 text-lg font-semibold">{s.title}</p>
                <p className="m-0 text-[14px] leading-[21px]" style={{ color: "var(--ink-2)" }}>
                  {s.goal}
                </p>
              </div>
              <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                {covered(s.id)} of {s.twists.length} situations · {s.keyPhrases.length} key phrases
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow m-0">Topics</h2>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <Link key={t.id} href={`/talk/live?topic=${t.id}`} className="btn">
              {t.title}
            </Link>
          ))}
        </div>
        <form
          className="flex max-w-[560px] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim()) router.push(`/talk/live?topic=${encodeURIComponent(topic.trim())}`);
          }}
        >
          <label htmlFor="own-topic" className="sr-only">
            Talk about any topic
          </label>
          <input id="own-topic" className="input" placeholder="Talk about…" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <button type="submit" className="btn" disabled={!topic.trim()}>
            Start
          </button>
        </form>
      </section>
    </div>
  );
}
