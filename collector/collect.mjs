// Lambda, run every 5 minutes: reads Hunt's and Hill's live headcounts and
// appends one entry per series to that day's item in DynamoDB. If NC State is
// down for a library, that library writes nothing, so a gap stays a gap
// instead of becoming zeros; the other library still writes.
// The AWS SDK comes with the Lambda Node runtime; the .ts imports run through
// Node's built-in type stripping.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HILL_SENSORS, HUNT_SENSORS, readLibrary } from "../lib/occupancy.ts";
import { observations } from "../lib/history.ts";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function collect(s) {
  const { building, sensors } = await readLibrary(s);
  const { day, rows } = observations(s, building, sensors);
  await Promise.all(
    rows.map(([series, entry]) =>
      db.send(
        new UpdateCommand({
          TableName: process.env.TABLE,
          Key: { pk: `obs#${series}`, sk: day },
          UpdateExpression: "SET r = list_append(if_not_exists(r, :none), :one)",
          ExpressionAttributeValues: { ":none": [], ":one": [entry] },
        }),
      ),
    ),
  );
  const missing = Object.entries(sensors).filter(([, v]) => v === null).map(([id]) => Number(id));
  return { library: s.slug, day, series: rows.length, missingSensors: missing };
}

export async function handler() {
  const libs = [HUNT_SENSORS, HILL_SENSORS];
  const results = await Promise.allSettled(libs.map(collect));
  const out = results.map((r, i) => (r.status === "fulfilled" ? r.value : { library: libs[i].slug, error: String(r.reason) }));
  console.log(JSON.stringify(out));
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason; // counts toward the "collector failing" alarm
  return out;
}
