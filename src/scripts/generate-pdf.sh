#!/bin/sh

# Load environment variables from the .env file
set -a
[ -f /usr/src/app/.env ] && . /usr/src/app/.env
set +a

# Default values for from and to
GF_FROM=""
GF_TO=""

# Check arguments
while [ "$1" != "" ]; do
    case $1 in
        GF_DASH_URL )           shift
                                GF_DASH_URL=$1
                                ;;
        GF_USER )               shift
                                GF_USER=$1
                                ;;
        GF_PASSWORD )           shift
                                GF_PASSWORD=$1
                                ;;
        GF_FROM )               shift
                                GF_FROM=$1
                                ;;
        GF_TO )                 shift
                                GF_TO=$1
                                ;;
        * )                     echo "Option $1 not recognized"
                                exit 1
    esac
    shift
done

# Check that GF_DASH_URL is defined
if [ -z "$GF_DASH_URL" ]; then
  echo "The GF_DASH_URL variable must be defined."
  exit 1
fi

# Use default values from .env if arguments are not provided
GF_USER=${GF_USER:-$DEFAULT_GF_USER}
GF_PASSWORD=${GF_PASSWORD:-$DEFAULT_GF_PASSWORD}

# Add from and to parameters to the POST request if provided
JSON_PAYLOAD="{\"url\": \"${GF_DASH_URL}\""
if [ -n "$GF_FROM" ]; then
  JSON_PAYLOAD="${JSON_PAYLOAD}, \"from\": \"${GF_FROM}\""
fi
if [ -n "$GF_TO" ]; then
  JSON_PAYLOAD="${JSON_PAYLOAD}, \"to\": \"${GF_TO}\""
fi
JSON_PAYLOAD="${JSON_PAYLOAD}}"

# Get the server port from environment or use default
SERVER_PORT=${EXPORT_SERVER_PORT:-3001}

# Send the HTTP POST request to the Node.js server to generate the PDF
RESPONSE=$(curl -s -X POST http://localhost:${SERVER_PORT}/generate-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: grafana_session=${GF_USER}:${GF_PASSWORD}" \
  -d "$JSON_PAYLOAD")

# Check if curl command was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to the server. Make sure the server is running on port ${SERVER_PORT}"
  exit 1
fi

# Check if the response is valid JSON
if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
  PDF_URL=$(echo $RESPONSE | jq -r '.pdfUrl')
  if [ "$PDF_URL" != "null" ]; then
    echo "PDF generated successfully!"
    echo "PDF URL: $PDF_URL"
  else
    echo "Error generating PDF"
    echo "Server response: $RESPONSE"
    exit 1
  fi
else
  echo "Error: The server response is not valid JSON"
  echo "Raw response: $RESPONSE"
  exit 1
fi
