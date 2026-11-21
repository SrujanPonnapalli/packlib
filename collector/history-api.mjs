// Lambda behind a public function URL. Returns the building and its levels over
// the last week in the site's History format. Read-only, and it's all public
// NC State data anyway. Browsers/CDN can cache it for 5 minutes.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { lineUp, slot, typical } from "../lib/history.ts";
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

/**
 * 8 calendar days so we always cover a full 7 x 24 hours. `?library=hill` for Hill, Hunt by default.
 * The building also goes back another 4 weeks for the typical line, which compares against the same weekday.
 */
export async function handler(event) {
  const s = SENSORS[event?.queryStringParameters?.library ?? "hunt"];
  if (!s) return { statusCode: 404, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "unknown library" }) };
  const prefix = s.slug === "hunt" ? "" : `${s.slug}#`;
  const now = Date.now();
  const day = (ago) => slot(new Date(now - ago * 86_400_000).toISOString()).day;
  const [to, from, monthAgo] = [day(0), day(8), day(36)];
  const levels = Object.keys(s.levels).map((n) => `level#${n}`);
  const [since, building, ...all] = await Promise.all([firstDay(prefix), days(prefix + "building", monthAgo, to), ...levels.map((x) => days(prefix + x, from, to))]);
  const h = lineUp({ building: building.filter((d) => d.day >= from), ...Object.fromEntries(levels.map((l, i) => [l, all[i]])) }, since, now);
  h.usual = typical(h, lineUp({ building }, since, now));
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60, s-maxage=300" }, body: JSON.stringify(h) };
}
