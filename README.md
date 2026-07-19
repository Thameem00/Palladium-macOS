<div align="center">

# 🎬 Palladium macOS

**A sleek, native macOS wrapper for the Palladium media downloader.**  
Powered by a Node.js backend and a Swift-compiled Cocoa WebView window.

[![Platform](https://img.shields.io/badge/platform-macOS-black?style=flat-square&logo=apple)](https://www.apple.com/macos/)
[![Language](https://img.shields.io/badge/language-Swift%20%2B%20Node.js-orange?style=flat-square&logo=swift)](https://swift.org/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Thameem00/Palladium-macOS?style=flat-square)](https://github.com/Thameem00/Palladium-macOS/stargazers)

</div>

---

## Overview

**Palladium macOS** brings the power of the original [Palladium iOS app](https://github.com/tfourj/Palladium) to the desktop — packaged as a fully native macOS application. It wraps a local Node.js server inside a Swift-compiled Cocoa window, giving you a clean, browser-free experience with all the functionality of a real native app.

No Electron. No browser tabs. No address bars. Just a clean, native window.

---

## Features

- 🖥️ **Native macOS Window** — Built with Swift + Cocoa. Looks and feels like a real Mac app.
- ⚡ **Dynamic Port Selection** — Automatically finds a free port starting at `3000`. Supports running multiple instances simultaneously.
- 📋 **Full Keyboard Shortcut Support** — Native `Cmd+C`, `Cmd+V`, `Cmd+A`, `Cmd+Z` and all standard Edit menu shortcuts work out of the box.
- 🎯 **iOS-Matched Download Engine** — Arguments passed to `yt-dlp` exactly mirror the official Palladium iOS app behavior (thumbnail conversion, SSL bypass, playlist handling, subtitle embedding).
- 📦 **Self-Contained App Bundle** — All backend files (`server.js`, `public/`, `node_modules/`) are bundled inside the `.app` package itself.
- 🔒 **Clean Lifecycle** — The backend server starts when you open the app and terminates cleanly when you close it. No zombie processes.
- 🌐 **URL Allowlist Support** — Built-in allowlist logic (hidden from UI, always active) filters downloads based on configurable patterns.

---

## Prerequisites

Make sure the following are installed on your Mac before building:

| Tool | Install Command | Purpose |
|------|----------------|---------|
| **Node.js** | `brew install node` | Hosts the local backend server |
| **yt-dlp** | `brew install yt-dlp` | Core media downloading engine |
| **ffmpeg** | `brew install ffmpeg` | Merges audio/video and embeds thumbnails |
| **Xcode CLI Tools** | `xcode-select --install` | Required to compile the Swift wrapper |

> **Homebrew** is required. If you don't have it, install it from [brew.sh](https://brew.sh).

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Thameem00/Palladium-macOS.git
cd Palladium-macOS
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Compile & Build the Native App

```bash
python3 compile_native_app.py
```

This script will:
- Compile the Swift wrapper into a native binary
- Create `~/Applications/Palladium.app` with a proper `Info.plist`
- Bundle `server.js`, `public/`, and `node_modules/` inside the app package

### 4. Launch

Double-click **`Palladium.app`** from your Applications folder or Dock.

---

## How It Works

```
┌─────────────────────────────────────────┐
│           Palladium.app Bundle          │
│                                         │
│  ┌─────────────┐    ┌────────────────┐  │
│  │ Swift Cocoa │───▶│  WKWebView UI  │  │
│  │   Wrapper   │    └────────────────┘  │
│  └──────┬──────┘                        │
│         │ spawns                        │
│  ┌──────▼──────────────────────────┐    │
│  │   Node.js Server (server.js)    │    │
│  │   PORT: auto-selected (3000+)   │    │
│  └──────────────┬──────────────────┘    │
│                 │ invokes               │
│  ┌──────────────▼──────────────────┐    │
│  │       yt-dlp  +  ffmpeg         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

1. On launch, the Swift wrapper calls `findFreePort()` starting at `3000`.
2. It spawns `node server.js` with `PORT=<selected>` as an environment variable.
3. The `WKWebView` loads `http://localhost:<PORT>` after a short startup delay.
4. When the window is closed, `applicationWillTerminate` kills the Node process and frees the port.

---

## Project Structure

```
Palladium-macOS/
├── compile_native_app.py   # Build script — compiles Swift + creates .app bundle
├── server.js               # Node.js backend — API routes, yt-dlp integration
├── package.json            # NPM dependencies
├── public/
│   ├── index.html          # Main UI
│   ├── style.css           # Styles
│   ├── app.js              # Frontend logic
│   └── settings.js         # Settings page logic
└── README.md
```

---

## Credits

- Original iOS App — [**tfourj/Palladium**](https://github.com/tfourj/Palladium)
- Media downloading powered by [**yt-dlp**](https://github.com/yt-dlp/yt-dlp)
- Audio/video processing by [**ffmpeg**](https://ffmpeg.org/)

---

<div align="center">

Made with ❤️ for macOS

</div>
