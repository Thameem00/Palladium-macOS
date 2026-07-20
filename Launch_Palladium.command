#!/bin/bash
# Move to the script's directory dynamically (works on any Mac regardless of folder location)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Include local bin/ in PATH if present
if [ -d "$DIR/bin" ]; then
    export PATH="$DIR/bin:$PATH"
fi

# Check if Node.js is installed (system or local)
if ! command -v node &> /dev/null && [ ! -f "$DIR/bin/node" ]; then
    echo "================================================="
    echo " Node.js is missing!"
    echo " Running automatic setup to fetch dependencies..."
    echo "================================================="
    if [ -f "$DIR/setup.sh" ]; then
        bash "$DIR/setup.sh"
    else
        echo "Error: setup.sh not found. Please install Node.js."
        exit 1
    fi
fi

# Determine node binary path
NODE_BIN="node"
if [ -f "$DIR/bin/node" ]; then
    NODE_BIN="$DIR/bin/node"
fi

# Clear old port file
rm -f "$DIR/.current_port"

# Start the Node server directly in the background
"$NODE_BIN" server.js &
SERVER_PID=$!

# Wait for the server to bind and write port
BOUND_PORT=3000
for i in {1..20}; do
    if [ -f "$DIR/.current_port" ]; then
        BOUND_PORT=$(cat "$DIR/.current_port")
        break
    fi
    sleep 0.2
done

# Open the browser to the bound application port
open "http://localhost:$BOUND_PORT"

# Keep the terminal window open and allow stopping the server via Ctrl+C
echo "============================================="
echo " Palladium Mac is running at http://localhost:$BOUND_PORT"
echo " Press Ctrl+C in this terminal to stop the server."
echo "============================================="

cleanup() {
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Wait for the background process to exit
wait $SERVER_PID
