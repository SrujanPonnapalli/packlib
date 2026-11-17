// Lambda behind a public function URL: the building and its levels over the
// last week, as the site's History JSON. Read-only; the data is NC State's
// public headcounts. Browsers and the CDN may keep a copy for 5 minutes.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { lineUp, slot } from "../lib/history.ts";
import { LEVEL_IDS } from "../lib/occupancy.ts";

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

async function firstDay() {
  const res = await db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "obs#building" }, Limit: 1, ProjectionExpression: "sk" }));
  return res.Items?.[0]?.sk ?? null;
}

/** 8 calendar days, so a full 7 × 24 hours is covered. */
export async function handler() {
  const now = Date.now();
  const to = slot(new Date(now).toISOString()).day;
  const from = slot(new Date(now - 8 * 86_400_000).toISOString()).day;
  const series = ["building", ...Object.keys(LEVEL_IDS).map((n) => `level#${n}`)];
  const [since, ...all] = await Promise.all([firstDay(), ...series.map((s) => days(s, from, to))]);
  const h = lineUp(Object.fromEntries(series.map((s, i) => [s, all[i]])), since, now);
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60, s-maxage=300" }, body: JSON.stringify(h) };
}
