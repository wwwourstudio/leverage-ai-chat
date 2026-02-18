#!/bin/bash

# Kill process on port 3000 (or specified port)
# Usage: ./scripts/kill-port.sh [port]
# Example: ./scripts/kill-port.sh 3000

PORT=${1:-3000}

echo "Checking for processes on port $PORT..."

# Find process ID using the port
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "No process found running on port $PORT"
  exit 0
fi

echo "Found process $PID using port $PORT"
echo "Terminating process..."

# Kill the process
kill -9 $PID

if [ $? -eq 0 ]; then
  echo "Successfully terminated process on port $PORT"
  exit 0
else
  echo "Failed to terminate process on port $PORT"
  exit 1
fi
