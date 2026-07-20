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

> 💡 **Zero Setup Required**: Running `bash setup.sh` automatically fetches portable standalone binaries for Node.js, `ffmpeg`, and `yt-dlp` into a local `./bin/` folder if missing. Homebrew and Xcode CLI Tools are **completely optional**.

If you prefer using system-wide tools, you can optionally pre-install them via Homebrew:

| Tool | Install Command (Optional) | Purpose |
|------|----------------|---------|
| **Node.js** | `brew install node` | Hosts the local backend server |
| **yt-dlp** | `brew install yt-dlp` | Core media downloading engine |
| **ffmpeg** | `brew install ffmpeg` | Merges audio/video and embeds thumbnails |
| **Xcode CLI Tools** | `xcode-select --install` | Compiles Swift wrapper (AppleScript fallback available) |

---

## Installation (1-Step Setup for Any Mac)

### 1. Clone the Repository

```bash
git clone https://github.com/Thameem00/Palladium-macOS.git
cd Palladium-macOS
```

### 2. Run Automatic Setup

```bash
bash setup.sh
```

`setup.sh` will:
- Download local dependencies if missing on your Mac
- Clear macOS security quarantine flags
- Run `npm install`
- Compile and install `Palladium.app` in `~/Applications/` with the custom app icon

### 3. Launch

- Open **`Palladium.app`** from your Applications folder / Launchpad
- Or run **`./Launch_Palladium.command`**

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

1. On launch, the wrapper calls `findFreePort()` starting at `3000`.
2. It spawns `node server.js` with `PORT=<selected>` as an environment variable (with `EADDRINUSE` auto-retry).
3. The `WKWebView` loads `http://localhost:<PORT>` after a short startup delay.
4. When the window is closed, it kills the Node server process cleanly and frees the port.

---

## Project Structure

```
Palladium-macOS/
├── setup.sh                # 1-Step automated dependency installer & app builder
├── Launch_Palladium.command # Portable double-click launcher
├── compile_native_app.py   # Build script — compiles Swift/AppleScript + creates .app bundle
├── AppIcon.icns            # macOS high-resolution app icon
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
