#!/bin/bash
set -e

# sandbox-wire.sh for reserve-rec-public
# Updates config to point to sandbox API instead of dev
# Run this AFTER deploying the API sandbox, BEFORE deploying the public frontend

SANDBOX_NAME="${1:?Usage: ./sandbox-wire.sh <sandbox-name> [base-env]}"
BASE_ENV="${2:-dev}"
DEPLOYMENT_NAME="${SANDBOX_NAME}"
REGION="ca-central-1"

echo "========================================="
echo "Wiring public frontend to sandbox API"
echo "Sandbox: ${DEPLOYMENT_NAME}"
echo "========================================="
echo ""

# Verify API was deployed by checking if the API URL exists in SSM
SANDBOX_API_PATH="/reserveRecApi/${DEPLOYMENT_NAME}/publicApiStack/publicApiUrl"

echo "Step 1: Verifying API sandbox was deployed..."
echo "  Checking for: ${SANDBOX_API_PATH}"

API_URL=$(aws ssm get-parameter --region ${REGION} \
  --name "${SANDBOX_API_PATH}" \
  --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "${API_URL}" ]; then
  echo ""
  echo "ERROR: API sandbox not found!"
  echo ""
  echo "The Public API URL was not found at: ${SANDBOX_API_PATH}"
  echo ""
  echo "Please deploy the API sandbox first:"
  echo "  cd reserve-rec-api && SANDBOX_NAME=${SANDBOX_NAME} yarn sandbox:deploy"
  echo ""
  exit 1
fi

echo "  ✓ Found API: ${API_URL}"
echo ""

# Get current config
echo "Step 2: Updating distributionStack config..."
CONFIG_PATH="/reserveRecPublic/${DEPLOYMENT_NAME}/distributionStack/config"

CONFIG=$(aws ssm get-parameter --region ${REGION} \
  --name "${CONFIG_PATH}" \
  --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "${CONFIG}" ]; then
  echo "ERROR: Config not found at ${CONFIG_PATH}"
  echo "Did you run sandbox-setup.sh first?"
  exit 1
fi

# Update the API URL path to point to sandbox
UPDATED_CONFIG=$(echo "${CONFIG}" | jq --arg path "${SANDBOX_API_PATH}" '.publicApiUrlSSMPath = $path')

# Wire waiting room fields — SSM paths for HMAC key ARN and WAF ARN
HMAC_KEY_ARN_PATH="/reserveRecApi/${DEPLOYMENT_NAME}/waitingRoomStack/hmacSigningKeyArn"
WAF_ARN_PATH="/reserveRecPublic/${DEPLOYMENT_NAME}/waitingRoomEdgeStack/webAclArn"
UPDATED_CONFIG=$(echo "${UPDATED_CONFIG}" | jq \
  --arg enabled "true" \
  --arg hmacPath "${HMAC_KEY_ARN_PATH}" \
  --arg wafPath "${WAF_ARN_PATH}" \
  '.waitingRoomEnabled = $enabled | .hmacKeyArnSSMPath = $hmacPath | .webAclArnSSMPath = $wafPath')

# Save back to SSM
aws ssm put-parameter --region ${REGION} \
  --name "${CONFIG_PATH}" \
  --type String \
  --value "${UPDATED_CONFIG}" \
  --overwrite >/dev/null

echo "  ✓ Updated publicApiUrlSSMPath -> ${SANDBOX_API_PATH}"
echo "  ✓ Updated waitingRoomEnabled -> true"
echo "  ✓ Updated hmacKeyArnSSMPath -> ${HMAC_KEY_ARN_PATH}"
echo "  ✓ Updated webAclArnSSMPath -> ${WAF_ARN_PATH}"
echo ""
echo "========================================="
echo "Wiring complete!"
echo "========================================="
echo ""
echo "Next step: Deploy the public frontend"
echo "  SANDBOX_NAME=${SANDBOX_NAME} yarn sandbox:deploy"
echo ""
