#!/usr/bin/env bash
# Creates or updates the PackLib collector on AWS (the AWS resources still use the old studyscape names), then uploads the code.
# Usage: scripts/deploy-collector.sh [you@example.com]   (alert email, only needed the first time)
# Needs the AWS CLI, signed in. The AWS project only allows US East (Ohio).
set -euo pipefail
cd "$(dirname "$0")/.."
params=(); [[ -n "${1:-}" ]] && params=(--parameter-overrides "AlertEmail=$1")
export AWS_REGION=${AWS_REGION:-us-east-2}

aws cloudformation deploy --stack-name studyscape-collector --template-file collector/template.yaml \
  --capabilities CAPABILITY_IAM ${params[@]+"${params[@]}"} --no-fail-on-empty-changeset

zip=$(mktemp -d)/collect.zip
zip -q "$zip" package.json collector/collect.mjs collector/history-api.mjs lib/occupancy.ts lib/history.ts
for fn in studyscape-collect studyscape-history; do
  aws lambda update-function-code --function-name "$fn" --zip-file "fileb://$zip" --query LastModified --output text
  aws lambda wait function-updated --function-name "$fn"
done
echo "Deployed. Test run:"
aws lambda invoke --function-name studyscape-collect --log-type Tail --query LogResult --output text /dev/null | base64 --decode | tail -5
echo "History URL (set as HISTORY_URL for the site):"
aws cloudformation describe-stacks --stack-name studyscape-collector --query "Stacks[0].Outputs[?OutputKey=='HistoryUrl'].OutputValue" --output text
