"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  ActivityEntry,
  Conversation,
  Dimension,
  Phrase,
  Recording,
  SceneProgress,
  UserList,
  Video,
} from "./types";

class ToneDB extends Dexie {
  videos!: EntityTable<Video, "id">;
  phrases!: EntityTable<Phrase, "id">;
  conversations!: EntityTable<Conversation, "id">;
  sceneProgress!: EntityTable<SceneProgress, "sceneId">;
  activity!: EntityTable<ActivityEntry, "id">;
  recordings!: EntityTable<Recording, "id">;
  lists!: EntityTable<UserList, "id">;

  constructor() {
    super("tone");
    this.version(1).stores({
      videos: "id, youtubeId, updatedAt",
      phrases: "id, createdAt, srs.due, type, *dimensions, *listIds",
      conversations: "id, sceneId, createdAt",
      sceneProgress: "sceneId",
      activity: "++id, at, dimension",
      recordings: "id, videoId",
      lists: "id",
    });
  }
}

export const db = new ToneDB();

export function uid(): string {
  return crypto.randomUUID();
}

/** Log practice time against one of the four dimensions (feeds Today's balance bar). */
export async function logActivity(dimension: Dimension, seconds: number) {
  if (seconds < 1) return;
  await db.activity.add({ at: Date.now(), dimension, seconds: Math.round(seconds) });
}

export function startOfWeek(now = new Date()): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export async function exportAll(): Promise<Blob> {
  const data = {
    app: "tone",
    version: 1,
    exportedAt: new Date().toISOString(),
    videos: await db.videos.toArray(),
    phrases: await db.phrases.toArray(),
    conversations: await db.conversations.toArray(),
    sceneProgress: await db.sceneProgress.toArray(),
    activity: await db.activity.toArray(),
    lists: await db.lists.toArray(),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

export async function importAll(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "tone") throw new Error("This file isn't a Tone export.");
  await db.transaction(
    "rw",
    [db.videos, db.phrases, db.conversations, db.sceneProgress, db.activity, db.lists],
    async () => {
      await db.videos.bulkPut(data.videos ?? []);
      await db.phrases.bulkPut(data.phrases ?? []);
      await db.conversations.bulkPut(data.conversations ?? []);
      await db.sceneProgress.bulkPut(data.sceneProgress ?? []);
      await db.activity.bulkPut(data.activity ?? []);
      await db.lists.bulkPut(data.lists ?? []);
    },
  );
  return (data.phrases ?? []).length;
}
