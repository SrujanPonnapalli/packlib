// Reads the collector's history from DynamoDB, on the server only. Every
// visitor shares one read for five minutes, like the live occupancy route.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { cacheLife } from "next/cache";
import { lineUp, slot, type Entry, type History, type Series } from "./history.ts";
import { LEVEL_IDS } from "./occupancy.ts";

const TABLE = process.env.HISTORY_TABLE ?? "studyscape";
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.HISTORY_REGION ?? "us-east-2" }));

async function days(series: Series, from: string, to: string) {
  const out: { day: string; r: Entry[] }[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
        ExpressionAttributeValues: { ":pk": `obs#${series}`, ":from": from, ":to": to },
        ExclusiveStartKey: start,
      }),
    );
    for (const item of res.Items ?? []) out.push({ day: item.sk, r: item.r });
    start = res.LastEvaluatedKey;
  } while (start);
  return out;
}

async function firstDay() {
  const res = await db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "obs#building" }, Limit: 1, ProjectionExpression: "sk" }));
  return (res.Items?.[0]?.sk as string | undefined) ?? null;
}

/** The building and its levels over the last week (8 calendar days, so a full 7 × 24 hours is covered). */
export async function recentHistory(): Promise<History> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const now = Date.now();
  const to = slot(new Date(now).toISOString()).day;
  const from = slot(new Date(now - 8 * 86_400_000).toISOString()).day;
  const series: Series[] = ["building", ...Object.keys(LEVEL_IDS).map((n) => `level#${n}`)];
  const [since, ...all] = await Promise.all([firstDay(), ...series.map((s) => days(s, from, to))]);
  return lineUp(Object.fromEntries(series.map((s, i) => [s, all[i]])), since, now);
}
