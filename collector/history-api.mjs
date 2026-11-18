// Lambda behind a public function URL: the building and its levels over the
// last week, as the site's History JSON. Read-only; the data is NC State's
// public headcounts. Browsers and the CDN may keep a copy for 5 minutes.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { lineUp, slot } from "../lib/history.ts";
import { SENSORS } from "../lib/occupancy.ts";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;

async function days(series, from, to) {
  const out = [];
  let start;
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

async function firstDay(prefix) {
  const res = await db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": `obs#${prefix}building` }, Limit: 1, ProjectionExpression: "sk" }));
  return res.Items?.[0]?.sk ?? null;
}

/** 8 calendar days, so a full 7 × 24 hours is covered. `?library=hill` picks Hill; Hunt by default. */
export async function handler(event) {
  const s = SENSORS[event?.queryStringParameters?.library ?? "hunt"];
  if (!s) return { statusCode: 404, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "unknown library" }) };
  const prefix = s.slug === "hunt" ? "" : `${s.slug}#`;
  const now = Date.now();
  const to = slot(new Date(now).toISOString()).day;
  const from = slot(new Date(now - 8 * 86_400_000).toISOString()).day;
  const series = ["building", ...Object.keys(s.levels).map((n) => `level#${n}`)];
  const [since, ...all] = await Promise.all([firstDay(prefix), ...series.map((x) => days(prefix + x, from, to))]);
  const h = lineUp(Object.fromEntries(series.map((s, i) => [s, all[i]])), since, now);
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60, s-maxage=300" }, body: JSON.stringify(h) };
}
