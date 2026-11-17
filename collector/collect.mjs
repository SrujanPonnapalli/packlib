// Lambda, run every 5 minutes: reads Hunt's live headcounts and appends one
// entry per series to that day's item in DynamoDB. If NC State is down the run
// fails and writes nothing, so a gap stays a gap instead of becoming zeros.
// The AWS SDK comes with the Lambda Node runtime; the .ts imports run through
// Node's built-in type stripping.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { readHunt } from "../lib/occupancy.ts";
import { observations } from "../lib/history.ts";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler() {
  const { building, levels } = await readHunt();
  const { day, rows } = observations(building, levels);
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
  const missing = Object.entries(levels).filter(([, v]) => v === null).map(([n]) => n);
  console.log(JSON.stringify({ day, series: rows.length, missingLevels: missing }));
  return { day, series: rows.length };
}
