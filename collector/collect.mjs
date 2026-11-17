// Lambda that runs every 5 minutes. Reads Hunt's live headcounts and appends one
// entry per series to that day's DynamoDB item. If NC State is down the run fails
// and nothing gets written, so gaps stay gaps instead of turning into zeros.
// The AWS SDK is built into the Lambda Node runtime, and the .ts imports work
// because of Node's built-in type stripping.

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
