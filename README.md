# Palladium macOS Wrapper

A native macOS web app wrapper for the Palladium media downloader, utilizing a Node.js backend and a Swift-compiled Cocoa webview window.

This project packages the web UI and downloader engine into a native macOS app bundle (`Palladium.app`) that runs standalone, manages its own server lifecycle, and dynamically resolves port collisions.

## Features
- **Standalone Native App**: Double-click to open, close to terminate the backend server.
- **Dynamic Port Selection**: Automatically searches for a free port starting at `3000` to avoid conflicts (allows running multiple instances).
- **Edit & Context Menu Shortcuts**: Restores fully functional native copy, paste, select all, undo, and redo shortcut keybindings (`Cmd+C`, `Cmd+V`, etc.).
- **Smart Arguments Matching**: Matches the exact argument options of the original iOS Palladium app (e.g. converting thumbnails to PNG, SSL check bypasses, subtitle write overrides).
- **Bundled Resources**: Packages all server files and web pages directly inside the `.app` bundle resources for absolute portability.

## Prerequisites

To build and run the application, the target Mac needs the following utilities installed:

1. **Node.js**: Host the backend API router.
   ```bash
   brew install node
   ```
2. **yt-dlp**: Core media downloader CLI.
   ```bash
   brew install yt-dlp
   ```
3. **ffmpeg**: Required by yt-dlp to merge audio/video formats and convert thumbnails.
   ```bash
   brew install ffmpeg
   ```

## Installation & Build

1. Clone this repository to your local directory:
   ```bash
   git clone <your-repo-url> PalladiumMac
   cd PalladiumMac
   ```
2. Install NPM dependencies:
   ```bash
   npm install
   ```
3. Compile and build the native macOS application bundle:
   ```bash
   python3 compile_native_app.py
   ```

The script will compile the Swift code, create/update `/Users/<username>/Applications/Palladium.app`, and bundle all the Node.js server scripts, public assets, and `node_modules` directly inside the app bundle's resources.

## Lifecycle Details
- On launch, the wrapper Swift code calls `findFreePort()` starting at `3000`. 
- It spawns the Node server process in the background, feeding the free port as the `PORT` environment variable.
- It binds the Swift `WKWebView` to the selected localhost port.
- When the window is closed, the app terminates the Node server process cleanly, freeing up the port.
