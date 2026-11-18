"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CurrencyChip, RegisterChip } from "@/components/chips";
import { IconPlay } from "@/components/icons";
import { db, startOfWeek } from "@/lib/db";
import { SCENES } from "@/lib/scenes";
import { DIMENSIONS, type Dimension } from "@/lib/types";

const DIM_COLORS: Record<Dimension, string> = {
  Expression: "#8EA0FF",
  Accent: "#B7C9AF",
  Interaction: "var(--accent)",
  Culture: "#E7C873",
};

function greeting(h: number) {
  if (h < 5) return "Up late?";
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

export default function TodayPage() {
  const data = useLiveQuery(async () => {
    const t = Date.now();
    const week = startOfWeek();
    const [phrases, lastVideo, progress, activity, convCount] = await Promise.all([
      db.phrases.toArray(),
      db.videos.orderBy("updatedAt").last(),
      db.sceneProgress.toArray(),
      db.activity.where("at").aboveOrEqual(week).toArray(),
      db.conversations.count(),
    ]);
    const due = phrases.filter((p) => p.srs.due <= t).length;
    const usedThisWeek = phrases.filter((p) => (p.usedAt ?? 0) >= week).length;
    const minutes = Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Record<Dimension, number>;
    for (const a of activity) minutes[a.dimension] += a.seconds / 60;
    return { phrases, due, usedThisWeek, lastVideo, progress, minutes, convCount, now: new Date(t) };
  }, []);

  if (!data) return null;
  const now = data.now;

  const firstLaunch = data.phrases.length === 0 && !data.lastVideo && data.convCount === 0;

  // The Scene with the most situations still to try.
  const scored = SCENES.map((s) => {
    const covered = data.progress.find((p) => p.sceneId === s.id)?.covered ?? [];
    return { scene: s, fresh: s.twists.filter((t) => !covered.includes(t.id)) };
  }).sort((a, b) => b.fresh.length / b.scene.twists.length - a.fresh.length / a.scene.twists.length);
  const next = scored[0];
  const freshNames = next.fresh
    .slice(0, 2)
    .map((t) => t.label.toLowerCase().replace(/["?.!]/g, ""))
    .join(" and ");

  // Phrase of the day: one of yours that has a "long way", else a Scene's key phrase.
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const mine = data.phrases.filter((p) => p.longVersion);
  const builtIn = SCENES.flatMap((s) => s.keyPhrases);
  const potd = mine.length
    ? { text: mine[dayIndex % mine.length].text, long: mine[dayIndex % mine.length].longVersion, register: mine[dayIndex % mine.length].register, id: mine[dayIndex % mine.length].id }
    : { text: builtIn[dayIndex % builtIn.length].text, long: builtIn[dayIndex % builtIn.length].longVersion, register: builtIn[dayIndex % builtIn.length].register, id: null };

  const totalMin = DIMENSIONS.reduce((s, d) => s + data.minutes[d], 0);
  const light = totalMin > 10 ? DIMENSIONS.find((d) => data.minutes[d] / totalMin < 0.15) : undefined;

  const reviewFirst = data.due >= 5;
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
          {dateLabel}
        </p>
        <h1 className="m-0 text-[32px] leading-10 font-semibold tracking-tight">{greeting(now.getHours())}</h1>
      </header>

      {firstLaunch ? (
        <section className="glass rise flex flex-wrap items-center justify-between gap-6 rounded-3xl px-9 py-8" style={{ boxShadow: "var(--shadow-md)" }}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
            <p className="eyebrow m-0">Start here</p>
            <h2 className="m-0 text-[26px] leading-8 font-semibold">Start with a conversation</h2>
            <p className="m-0 text-[17px] leading-7" style={{ color: "var(--ink-2)" }}>
              Order a coffee from an American barista. Talk out loud; ask for a more native version whenever you want one.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/talk/live?scene=coffee" className="btn btn-primary min-h-12 px-6 text-base">
              Start conversation
            </Link>
            <Link href="/watch" className="btn btn-ghost text-sm">
              or paste a video
            </Link>
          </div>
        </section>
      ) : (
        <section className="glass rise flex flex-wrap items-center justify-between gap-6 rounded-3xl px-9 py-8" style={{ boxShadow: "var(--shadow-md)" }}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
            <p className="eyebrow m-0">Suggested for today</p>
            {reviewFirst ? (
              <>
                <h2 className="m-0 text-[26px] leading-8 font-semibold">Review {data.due} phrases</h2>
                <p className="m-0 text-[17px] leading-7" style={{ color: "var(--ink-2)" }}>
                  They’re due now. About {Math.max(3, Math.round(data.due / 3))} minutes.
                </p>
              </>
            ) : (
              <>
                <h2 className="m-0 text-[26px] leading-8 font-semibold">Talk · {next.scene.title}</h2>
                <p className="m-0 text-[17px] leading-7" style={{ color: "var(--ink-2)" }}>
                  {next.fresh.length
                    ? `Situations you haven’t tried yet, like ${freshNames}. About 8 minutes.`
                    : "You’ve covered every situation here. Run it again for speed. About 8 minutes."}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {reviewFirst ? (
              <>
                <Link href="/review" className="btn btn-primary min-h-12 px-6 text-base">
                  Start review
                </Link>
                <Link href={`/talk/live?scene=${next.scene.id}`} className="btn btn-ghost text-sm">
                  or talk · {next.scene.title}
                </Link>
              </>
            ) : (
              <>
                <Link href={`/talk/live?scene=${next.scene.id}`} className="btn btn-primary min-h-12 px-6 text-base">
                  Start conversation
                </Link>
                {data.due > 0 && (
                  <Link href="/review" className="btn btn-ghost text-sm">
                    or review {data.due} phrase{data.due === 1 ? "" : "s"}
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.lastVideo ? (
          <Link href={`/watch/${data.lastVideo.id}`} className="card flex items-center gap-5 p-5 no-underline" style={{ color: "var(--ink)" }}>
            <div className="relative h-24 w-[168px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: "var(--wash)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${data.lastVideo.youtubeId}/mqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <span className="absolute inset-0 flex items-center justify-center text-white">
                <IconPlay size={28} />
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="eyebrow m-0">Continue watching</p>
              <p className="m-0 truncate text-[17px] leading-6 font-semibold">{data.lastVideo.title}</p>
              <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                Line {data.lastVideo.currentLine + 1} of {data.lastVideo.lines.length}
              </p>
              <div aria-hidden="true" className="h-1 rounded" style={{ background: "var(--hairline)" }}>
                <div
                  className="h-1 rounded"
                  style={{
                    width: `${Math.round(((data.lastVideo.currentLine + 1) / Math.max(1, data.lastVideo.lines.length)) * 100)}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/watch" className="card flex flex-col justify-center gap-1.5 p-5 no-underline" style={{ color: "var(--ink)" }}>
            <p className="eyebrow m-0">Watch</p>
            <p className="m-0 text-[17px] font-semibold">Add a vlog you like</p>
            <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
              Paste a YouTube link, then shadow it line by line.
            </p>
          </Link>
        )}

        <section aria-label="Phrase of the day" className="card flex flex-col gap-2.5 px-6 py-5">
          <p className="eyebrow m-0">Phrase of the day</p>
          <p className="m-0 text-sm leading-[22px] line-through" style={{ color: "var(--muted)", textDecorationColor: "var(--hairline-2)" }}>
            “{potd.long}”
          </p>
          <div className="flex items-center justify-between gap-3">
            {potd.id ? (
              <Link href={`/notebook/${potd.id}`} className="text-2xl font-semibold tracking-tight no-underline" style={{ color: "var(--ink)" }}>
                “{potd.text}”
              </Link>
            ) : (
              <span className="text-2xl font-semibold tracking-tight">“{potd.text}”</span>
            )}
            <span className="flex gap-1.5">
              <RegisterChip value={potd.register} />
              <CurrencyChip value="Timeless" />
            </span>
          </div>
        </section>
      </div>

      <section aria-label="This week" className="flex flex-col gap-3 px-1 py-2">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow m-0">This week</h2>
          <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
            Used in real life: <strong style={{ color: "var(--ink)" }}>{data.usedThisWeek} phrase{data.usedThisWeek === 1 ? "" : "s"}</strong>
          </p>
        </div>
        <div aria-hidden="true" className="flex h-2 gap-1">
          {totalMin === 0 ? (
            <div className="flex-1 rounded" style={{ background: "var(--hairline)" }} />
          ) : (
            DIMENSIONS.map((d) =>
              data.minutes[d] > 0 ? (
                <div key={d} className="rounded" style={{ flex: data.minutes[d], background: DIM_COLORS[d] }} />
              ) : null,
            )
          )}
        </div>
        <div className="flex flex-wrap gap-5 text-[13px]" style={{ color: "var(--ink-2)" }}>
          {DIMENSIONS.map((d) => (
            <span key={d}>
              {d} · {Math.round(data.minutes[d])} min
              {light === d && <span style={{ color: "var(--twist-ink)" }}> · a little light</span>}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
