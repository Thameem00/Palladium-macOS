#!/bin/bash
# Move to the project directory
cd "/Users/thameemrahman/PalladiumMac"

# Start the Node server in the background
npm start &
SERVER_PID=$!

# Wait 2 seconds for the server to bind to port 3000
sleep 2

# Open the browser to the application
open "http://localhost:3000"

# Keep the terminal window open and allow stopping the server via Ctrl+C
echo "============================================="
echo " Palladium Mac is running at http://localhost:3000"
echo " Press Ctrl+C in this terminal to stop the server."
echo "============================================="

# Wait for the background process to exit
wait $SERVER_PID
