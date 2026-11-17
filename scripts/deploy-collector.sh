#!/usr/bin/env bash
# Creates or updates the StudyScape collector on AWS, then uploads its code.
# Usage: scripts/deploy-collector.sh you@example.com   (where alerts go)
# Needs the AWS CLI, signed in. The AWS project only allows US East (Ohio).
set -euo pipefail
cd "$(dirname "$0")/.."
email=${1:?usage: scripts/deploy-collector.sh alert-email}
export AWS_REGION=${AWS_REGION:-us-east-2}

aws cloudformation deploy --stack-name studyscape-collector --template-file collector/template.yaml \
  --capabilities CAPABILITY_IAM --parameter-overrides "AlertEmail=$email" --no-fail-on-empty-changeset

zip=$(mktemp -d)/collect.zip
zip -q "$zip" package.json collector/collect.mjs lib/occupancy.ts lib/history.ts
aws lambda update-function-code --function-name studyscape-collect --zip-file "fileb://$zip" --query LastModified --output text
aws lambda wait function-updated --function-name studyscape-collect
echo "Deployed. Test run:"
aws lambda invoke --function-name studyscape-collect --log-type Tail --query LogResult --output text /dev/null | base64 --decode | tail -5
