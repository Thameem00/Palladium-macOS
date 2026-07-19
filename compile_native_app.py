import os
import subprocess
import shutil

def main():
    scratch_dir = "/Users/thameemrahman/.gemini/antigravity-cli/brain/50e1d439-a0f1-453b-9560-88678acaaa9b/scratch"
    swift_file = os.path.join(scratch_dir, "main.swift")
    binary_path = os.path.join(scratch_dir, "Palladium")
    
    target_binary = "/Users/thameemrahman/Applications/Palladium.app/Contents/MacOS/Palladium"
    
    # Swift code for the native window app
    swift_code = """import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?
    var selectedPort: Int = 3000

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Find a free port dynamically
        selectedPort = findFreePort(startingAt: 3000)
        
        // 2. Start the Node.js server on that port
        startServer(on: selectedPort)

        // 3. Setup System Main Menu (Required for Command+C / Command+V copy-paste keyboard shortcuts)
        setupMainMenu()

        // 4. Set up the window (closable, titled, resizable, fullSizeContentView)
        let windowStyle: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 960, height: 640),
            styleMask: windowStyle,
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "Palladium"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.delegate = self

        // 5. Set up the WebView
        let webConfiguration = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        
        // Match the webview background
        webView.setValue(false, forKey: "drawsBackground")
        
        window.contentView = webView

        // Load the local server URL (wait 1 second for server startup)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if let url = URL(string: "http://localhost:\(self.selectedPort)") {
                let request = URLRequest(url: url)
                self.webView.load(request)
            }
        }

        window.makeKeyAndOrderFront(nil)
    }

    func setupMainMenu() {
        let mainMenu = NSMenu()
        NSApp.mainMenu = mainMenu
        
        // Application Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Palladium", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide Palladium", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthersItem = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthersItem.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Palladium", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        
        // Edit Menu (Enables Undo, Redo, Cut, Copy, Paste, and Select All keyboard shortcuts)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    }

    func findFreePort(startingAt startPort: Int) -> Int {
        var port = startPort
        while port < 65535 {
            if isPortFree(port) {
                return port
            }
            port += 1
        }
        return startPort
    }

    func isPortFree(_ port: Int) -> Bool {
        let checkProcess = Process()
        checkProcess.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        checkProcess.arguments = ["-i", ":\(port)", "-t"]
        let pipe = Pipe()
        checkProcess.standardOutput = pipe
        try? checkProcess.run()
        checkProcess.waitUntilExit()
        
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return data.isEmpty
    }

    func startServer(on port: Int) {
        print("Starting Node.js server on port \(port)...")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/node")
        process.arguments = ["/Users/thameemrahman/PalladiumMac/server.js"]
        
        // Pass the port to the Node server via environment
        var env = ProcessInfo.processInfo.environment
        env["PORT"] = String(port)
        process.environment = env
        
        // Hide standard output/error stream to keep system logs clean
        process.standardOutput = Pipe()
        process.standardError = Pipe()
        
        do {
            try process.run()
            self.serverProcess = process
            print("Node server started (PID \(process.processIdentifier))")
        } catch {
            print("Failed to start server: \(error)")
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let process = serverProcess, process.isRunning {
            process.terminate()
            print("Server process terminated.")
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        NSApplication.shared.terminate(self)
        return true
    }
}


// Start Cocoa Application
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
"""

    # Write Swift file
    with open(swift_file, "w", encoding="utf-8") as f:
        f.write(swift_code)
        
    print("Compiling Swift application...")
    
    # Get macOS SDK path dynamically
    sdk_path_process = subprocess.run(["xcrun", "--show-sdk-path", "--sdk", "macosx"], capture_output=True, text=True)
    sdk_path = sdk_path_process.stdout.strip()
    
    compile_cmd = ["swiftc", "-O"]
    if sdk_path:
        compile_cmd.extend(["-sdk", sdk_path])
    compile_cmd.extend([swift_file, "-o", binary_path])
    
    result = subprocess.run(compile_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("Compilation failed:")
        print(result.stderr)
        return
        
    # Copy binary to App Bundle
    print(f"Copying executable to {target_binary}...")
    shutil.copy2(binary_path, target_binary)
    os.chmod(target_binary, 0o755)
    
    # Cleanup temp files
    try: os.remove(swift_file)
    except: pass
    try: os.remove(binary_path)
    except: pass
    
    print("Native application compiled and updated successfully!")

if __name__ == '__main__':
    main()
