import os
import subprocess
import shutil

def main():
    # Detect directories dynamically
    home_dir = os.path.expanduser("~")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    
    # App Bundle Structure
    app_dir = os.path.join(home_dir, "Applications/Palladium.app")
    contents_dir = os.path.join(app_dir, "Contents")
    macos_dir = os.path.join(contents_dir, "MacOS")
    resources_dir = os.path.join(contents_dir, "Resources")
    
    print(f"Creating app bundle directories at {app_dir}...")
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(resources_dir, exist_ok=True)
    
    # Temporary compilation files
    swift_file = "/tmp/main.swift"
    binary_path = "/tmp/Palladium"
    target_binary = os.path.join(macos_dir, "Palladium")
    
    # Swift code for the native window app
    swift_code = """import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?
    var selectedPort: Int = 3000

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Find a free port dynamically starting at 3000
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

        // Load the local server URL (wait 1.2 seconds for server startup)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            if let url = URL(string: "http://localhost:\\(self.selectedPort)") {
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
        checkProcess.arguments = ["-i", ":\\(port)", "-t"]
        let pipe = Pipe()
        checkProcess.standardOutput = pipe
        try? checkProcess.run()
        checkProcess.waitUntilExit()
        
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return data.isEmpty
    }

    func startServer(on port: Int) {
        let resourcesPath = Bundle.main.resourcePath ?? "."
        let serverScriptPath = (resourcesPath as NSString).appendingPathComponent("server.js")
        let nodeExecutable = findNodeExecutable()
        
        print("Starting Node.js server (\\(nodeExecutable)) on port \\(port) with script \\(serverScriptPath)...")
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodeExecutable)
        process.arguments = [serverScriptPath]
        
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
            print("Node server started (PID \\(process.processIdentifier))")
        } catch {
            print("Failed to start server: \\(error)")
        }
    }

    func findNodeExecutable() -> String {
        let resourcesPath = Bundle.main.resourcePath ?? "."
        let bundledNode = (resourcesPath as NSString).appendingPathComponent("bin/node")
        if FileManager.default.fileExists(atPath: bundledNode) {
            return bundledNode
        }
        let paths = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/bin/node"
        ]
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return "node" // fallback
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

    # Write Info.plist
    info_plist_path = os.path.join(contents_dir, "Info.plist")
    info_plist_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Palladium</string>
    <key>CFBundleIdentifier</key>
    <string>app.getpalladium.mac</string>
    <key>CFBundleName</key>
    <string>Palladium</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
"""
    print("Writing Info.plist...")
    with open(info_plist_path, "w", encoding="utf-8") as f:
        f.write(info_plist_content)

    # Write Swift file
    print("Writing temporary Swift code...")
    with open(swift_file, "w", encoding="utf-8") as f:
        f.write(swift_code)
        
    print("Compiling Swift application...")
    
    compile_success = False
    try:
        # Get macOS SDK path dynamically
        sdk_path_process = subprocess.run(["xcrun", "--show-sdk-path", "--sdk", "macosx"], capture_output=True, text=True)
        sdk_path = sdk_path_process.stdout.strip()
        
        compile_cmd = ["swiftc", "-O"]
        if sdk_path:
            compile_cmd.extend(["-sdk", sdk_path])
        compile_cmd.extend([swift_file, "-o", binary_path])
        
        result = subprocess.run(compile_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            compile_success = True
            print(f"Copying executable to {target_binary}...")
            shutil.copy2(binary_path, target_binary)
            os.chmod(target_binary, 0o755)
        else:
            print("Swift compilation failed:")
            print(result.stderr)
    except Exception as e:
        print(f"Swift compiler error: {e}")

    # Fallback to AppleScriptObjC via osacompile if swiftc is unavailable
    if not compile_success:
        print("\n⚠️  Xcode CLI Tools (swiftc) unavailable or failed.")
        print("→ Falling back to native AppleScriptObjC app bundle via osacompile (no Xcode required)...")
        applescript_source = f"""
use framework "Foundation"
use framework "AppKit"
use framework "WebKit"

on run
    do shell script "/usr/bin/pkill -f 'node server.js' || true"
    set projectDir to "{project_dir}"
    
    set nodePath to "node"
    if exists posix file (projectDir & "/bin/node") then
        set nodePath to projectDir & "/bin/node"
    end if
    
    do shell script "/bin/bash -c 'cd " & quoted form of projectDir & " && " & quoted form of nodePath & " server.js > /dev/null 2>&1 &'"
    delay 1.5
    
    set myApp to current application's NSApplication's sharedApplication()
    myApp's setActivationPolicy:(current application's NSApplicationActivationPolicyRegular)
    
    set windowStyle to (current application's NSWindowStyleMaskTitled as integer) + (current application's NSWindowStyleMaskClosable as integer) + (current application's NSWindowStyleMaskMiniaturizable as integer) + (current application's NSWindowStyleMaskResizable as integer)
    set myWindow to current application's NSWindow's alloc()'s initWithContentRect:{{{{0, 0}}, {{{{1100, 720}}}} styleMask:windowStyle backing:(current application's NSBackingStoreBuffered) defer:false
    myWindow's setTitle:"Palladium"
    myWindow's setMinSize:{{800, 550}}
    myWindow's performSelector:"center"
    
    set webView to current application's WKWebView's alloc()'s initWithFrame:{{{{0, 0}}, {{{{1100, 720}}}}
    set targetURL to current application's NSURL's URLWithString:"http://localhost:3000"
    set request to current application's NSURLRequest's requestWithURL:targetURL
    webView's loadRequest:request
    
    myWindow's setContentView:webView
    myWindow's makeKeyAndOrderFront:nil
    myApp's activateIgnoringOtherApps:true
    
    myApp's performSelector:"run"
end run
"""
        temp_applescript = "/tmp/palladium_applet.applescript"
        with open(temp_applescript, "w", encoding="utf-8") as f:
            f.write(applescript_source)
        
        osa_res = subprocess.run(["osacompile", "-o", app_dir, temp_applescript], capture_output=True, text=True)
        if osa_res.returncode == 0:
            print("✓ Native AppleScriptObjC application bundle generated successfully!")
        else:
            print("❌ AppleScript compilation failed:", osa_res.stderr)
            return

    # Copy resources to Contents/Resources inside bundle
    print("Bundling Node.js backend resources inside the app bundle...")
    shutil.copy2(os.path.join(project_dir, "server.js"), os.path.join(resources_dir, "server.js"))
    shutil.copy2(os.path.join(project_dir, "package.json"), os.path.join(resources_dir, "package.json"))
    if os.path.exists(os.path.join(project_dir, "package-lock.json")):
        shutil.copy2(os.path.join(project_dir, "package-lock.json"), os.path.join(resources_dir, "package-lock.json"))
    
    # Copy folders (public, node_modules, bin)
    def copy_dir(folder_name):
        src = os.path.join(project_dir, folder_name)
        dst = os.path.join(resources_dir, folder_name)
        if os.path.exists(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
            
    copy_dir("public")
    copy_dir("node_modules")
    copy_dir("bin")
    
    # Cleanup temp files
    try: os.remove(swift_file)
    except: pass
    try: os.remove(binary_path)
    except: pass
    try: os.remove("/tmp/palladium_applet.applescript")
    except: pass
    
    print("\nNative application compiled, bundled and updated successfully!")
    print(f"Location: {app_dir}")

if __name__ == '__main__':
    main()
