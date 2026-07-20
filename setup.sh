#!/bin/bash
set -e

# Move to the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================================================"
echo "          PALLADIUM macOS — AUTOMATIC SETUP & DEPENDENCY INSTALLER"
echo "================================================================================"

# 1. Detect Architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo " Architecture: Apple Silicon (arm64)"
    NODE_URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-arm64.tar.gz"
    FFMPEG_URL="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip"
else
    echo " Architecture: Intel (x86_64)"
    NODE_URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-x64.tar.gz"
    FFMPEG_URL="https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip"
fi

YTDLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"

BIN_DIR="$DIR/bin"
mkdir -p "$BIN_DIR"

# 2. Check / Install Node.js
if command -v node &> /dev/null; then
    echo "✓ System Node.js found: $(node -v)"
elif [ -f "$BIN_DIR/node" ]; then
    echo "✓ Local Node.js found in bin/"
else
    echo "→ Node.js not found. Downloading portable Node.js binary..."
    curl --http1.1 -L "$NODE_URL" -o "$BIN_DIR/node.tar.gz"
    tar -xzf "$BIN_DIR/node.tar.gz" -C "$BIN_DIR" --strip-components=1
    rm -f "$BIN_DIR/node.tar.gz"
    echo "✓ Node.js installed to bin/"
fi

# Set PATH for remainder of setup script
export PATH="$BIN_DIR:$PATH"

# 3. Check / Install FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✓ System FFmpeg found: $(ffmpeg -version | head -n 1)"
elif [ -f "$BIN_DIR/ffmpeg" ]; then
    echo "✓ Local FFmpeg found in bin/"
else
    echo "→ FFmpeg not found. Downloading standalone macOS FFmpeg binary..."
    curl --http1.1 -L "$FFMPEG_URL" -o "$BIN_DIR/ffmpeg.zip"
    unzip -o "$BIN_DIR/ffmpeg.zip" -d "$BIN_DIR"
    rm -f "$BIN_DIR/ffmpeg.zip"
    chmod +x "$BIN_DIR/ffmpeg"
    echo "✓ FFmpeg installed to bin/"
fi

# 4. Check / Install yt-dlp
if command -v yt-dlp &> /dev/null; then
    echo "✓ System yt-dlp found"
elif [ -f "$BIN_DIR/yt-dlp" ]; then
    echo "✓ Local yt-dlp found in bin/"
else
    echo "→ yt-dlp not found. Downloading standalone yt-dlp binary..."
    curl --http1.1 -L "$YTDLP_URL" -o "$BIN_DIR/yt-dlp"
    chmod +x "$BIN_DIR/yt-dlp"
    echo "✓ yt-dlp installed to bin/"
fi

# 5. Remove Gatekeeper Quarantine Flags
echo "→ Clearing macOS quarantine security flags..."
xattr -dr com.apple.quarantine "$BIN_DIR" 2>/dev/null || true

# 6. Install NPM packages
echo "→ Installing Node.js packages (express, etc.)..."
if [ -f "$BIN_DIR/npm" ]; then
    "$BIN_DIR/npm" install
else
    npm install
fi

# 7. Make launch script executable
chmod +x "$DIR/Launch_Palladium.command" "$DIR/setup.sh" 2>/dev/null || true

echo "================================================================================"
echo " SETUP COMPLETE!"
echo " You can now launch Palladium by running:"
echo "   - ./Launch_Palladium.command"
echo "   - OR python3 compile_native_app.py (to build a native macOS .app bundle)"
echo "================================================================================"
