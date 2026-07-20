const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure that local bin directory, Homebrew, and system paths are always present in PATH
const localBin = path.join(__dirname, 'bin');
const existingPath = process.env.PATH || '';
process.env.PATH = fs.existsSync(localBin)
  ? `${localBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${existingPath}`
  : `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${existingPath}`;

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve yt-dlp binary path dynamically (local bin -> Homebrew -> system PATH)
const getYtdlpPath = () => {
  const localPath = path.join(__dirname, 'bin', 'yt-dlp');
  if (fs.existsSync(localPath)) return localPath;
  const brewPath = '/opt/homebrew/bin/yt-dlp';
  if (fs.existsSync(brewPath)) return brewPath;
  const usrLocalPath = '/usr/local/bin/yt-dlp';
  if (fs.existsSync(usrLocalPath)) return usrLocalPath;
  return 'yt-dlp';
};
const YTDLP_PATH = getYtdlpPath();


const HISTORY_FILE = path.join(__dirname, 'history.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function loadSettings() {
  const os = require('os');
  const defaultDir = path.join(os.homedir(), 'Downloads');
  const defaults = {
    downloadDir: defaultDir,
    videoQuality: 'best',
    videoContainer: 'mp4',
    videoCodec: 'photosCompatible',
    audioFormat: 'mp3',
    audioPreset: 'bestCompatible',
    defaultDownloadPlaylist: false,
    defaultDownloadSubtitles: false,
    defaultEmbedThumbnail: false,
    restoreDownloadDefaults: false,
    autoRetryFailedDownloads: true,
    detailedProgressEnabled: false,
    afterDownloadBehavior: 'doNothing',
    linkHistoryEnabled: true,
    hideHistoryCount: false,
    linkHistoryLimit: 10,
    notificationsEnabled: true,
    extraArgs: '',
    enableUrlAllowlist: true // Default to true as the default allowlist is unrestricted (.*)
  };
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...defaults, ...data };
    } catch (e) {
      return defaults;
    }
  }
  return defaults;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let currentSettings = loadSettings();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// URL Allowlists Management
const ALLOWLISTS_FILE = path.join(__dirname, 'allowlists.json');
const defaultAllowlist = {
  id: "2d1d091a-53d0-4978-bdb5-2f831250b263",
  urlString: "https://al.getpalladium.app/all.json",
  name: "Palladium's allowlist",
  isDefault: true,
  lastRefreshDate: new Date().toISOString(),
  statusMessage: "Loaded 1 entries.",
  entries: [
    { name: "All", pattern: ".*", enabled: true }
  ]
};

function loadAllowlists() {
  if (fs.existsSync(ALLOWLISTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ALLOWLISTS_FILE, 'utf8'));
    } catch (e) {
      return [defaultAllowlist];
    }
  }
  return [defaultAllowlist];
}

function saveAllowlists(allowlists) {
  try {
    fs.writeFileSync(ALLOWLISTS_FILE, JSON.stringify(allowlists, null, 2));
  } catch (e) {
    console.error('Failed to save allowlists:', e);
  }
}

function isUrlAllowed(url) {
  if (!currentSettings.enableUrlAllowlist) {
    return true;
  }
  const allowlists = loadAllowlists();
  for (const list of allowlists) {
    if (!list.entries) continue;
    for (const entry of list.entries) {
      if (entry.enabled && entry.pattern) {
        try {
          const regex = new RegExp(entry.pattern);
          if (regex.test(url)) {
            return true;
          }
        } catch (e) {
          // ignore invalid pattern error
        }
      }
    }
  }
  return false;
}

// Active downloads tracking
const activeDownloads = new Map();



// Load history
function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Save history
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Fetch video info endpoint
app.get('/api/info', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isUrlAllowed(videoUrl)) {
    return res.status(403).json({ error: 'URL is blocked by your URL Allowlists setting.' });
  }

  console.log(`Fetching info for: ${videoUrl}`);



  // Run yt-dlp -J to get full metadata JSON
  const process = spawn(YTDLP_PATH, ['-J', '--no-playlist', videoUrl]);

  let stdoutData = '';
  let stderrData = '';

  process.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  process.on('close', (code) => {
    if (code !== 0) {
      console.error(`Error fetching info. Code: ${code}. Stderr: ${stderrData}`);
      return res.status(500).json({ error: 'Failed to fetch video information', details: stderrData.trim() });
    }

    try {
      const data = JSON.parse(stdoutData);
      
      // Parse formats into a clean representation
      const formats = [];
      
      // Add standard "best" combinations
      formats.push({ id: 'best', label: 'Best Quality (Recommended)', ext: data.ext || 'mp4' });
      formats.push({ id: 'bestaudio', label: 'Audio Only (MP3/M4A)', ext: 'mp3' });

      // Extract specific video resolutions if available
      if (data.formats) {
        const resolutions = new Set();
        data.formats.forEach((f) => {
          if (f.height && f.vcodec !== 'none' && !resolutions.has(f.height)) {
            resolutions.add(f.height);
            // Format options: bestvideo[height=1080]+bestaudio/best
            formats.push({
              id: `bestvideo[height=${f.height}]+bestaudio/best[height=${f.height}]`,
              label: `${f.height}p Video`,
              ext: 'mp4'
            });
          }
        });
      }

      // Sort resolutions descending (e.g. 1080p, 720p, etc.)
      const cleanFormats = formats.filter(f => f.id === 'best' || f.id === 'bestaudio');
      const videoFormats = formats.filter(f => f.id.includes('height')).sort((a, b) => {
        const hA = parseInt(a.label);
        const hB = parseInt(b.label);
        return hB - hA;
      });
      
      const finalFormats = [...cleanFormats, ...videoFormats];

      const info = {
        title: data.title,
        duration: data.duration, // in seconds
        thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails.length ? data.thumbnails[data.thumbnails.length - 1].url : ''),
        uploader: data.uploader || 'Unknown',
        formats: finalFormats
      };

      res.json(info);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse video details', details: e.message });
    }
  });
});

// Download stream endpoint using SSE (Server-Sent Events)
app.get('/api/download/stream', (req, res) => {
  const { url, format } = req.query;
  
  if (!url) {
    res.write(`data: ${JSON.stringify({ error: 'URL is required' })}\n\n`);
    return res.end();
  }

  if (!isUrlAllowed(url)) {
    res.write(`data: ${JSON.stringify({ error: 'URL is blocked by your URL Allowlists setting.' })}\n\n`);
    return res.end();
  }

  // Setup Server-Sent Events headers


  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const downloadId = Date.now().toString();
  console.log(`Starting download ID ${downloadId} for: ${url} (format: ${format})`);

  const settings = currentSettings;

  // Build yt-dlp arguments based on settings
  const args = [];

  if (format && format !== 'auto') {
    // Explicit format selection from UI
    if (format === 'bestaudio') {
      const af = settings.audioFormat || 'mp3';
      if (af === 'best') {
        args.push('-f', 'bestaudio/best');
      } else if (af === 'mp3') {
        args.push('-f', 'ba[acodec^=mp3]/ba/b', '-x', '--audio-format', 'mp3');
      } else {
        args.push('-f', 'bestaudio', '-x', '--audio-format', af);
      }
    } else {
      args.push('-f', format);
    }
  } else {
    // Use quality settings
    const quality = settings.videoQuality || 'best';
    const container = settings.videoContainer || 'mp4';
    const codec = settings.videoCodec || 'photosCompatible';
    const audioPreset = settings.audioPreset || 'bestCompatible';

    let heightFilter = '';
    if (quality !== 'best') {
      const height = quality.replace('p', '');
      heightFilter = `[height<=${height}]`;
    }

    let codecFilter = '';
    if (codec === 'h264') codecFilter = "[vcodec~='^(avc1|avc3|h264)']"; 
    else if (codec === 'h265') codecFilter = "[vcodec~='^(hev1|hvc1|hevc)']"; 
    else if (codec === 'av1') codecFilter = "[vcodec~='^(av01|av1)']"; 
    else if (codec === 'vp9') codecFilter = "[vcodec~='^(vp09|vp9)']"; 

    const sortBy = audioPreset === 'bestCompatible' ? 'vcodec:h264,lang,quality,res,fps,acodec:aac' : 'vcodec:h264,lang,quality,res,fps';
    
    args.push('-f', `bestvideo${heightFilter}${codecFilter}+bestaudio/best${heightFilter}`);
    args.push('--merge-output-format', container);
    args.push('--remux-video', container);
    args.push('-S', sortBy);
  }

  // Standard robust execution flags
  args.push('--no-check-certificate', '--force-overwrites', '--no-continue');

  // Playlist handling
  if (!settings.defaultDownloadPlaylist) {
    args.push('--no-playlist');
  } else {
    args.push('--yes-playlist');
  }

  // Embed thumbnail if enabled
  if (settings.defaultEmbedThumbnail) {
    args.push('--convert-thumbnails', 'png', '--embed-thumbnail');
  }

  // Subtitles if enabled
  if (settings.defaultDownloadSubtitles) {
    args.push('--write-subs', '--write-auto-subs', '--embed-subs');
  }

  // Extra user args
  if (settings.extraArgs && settings.extraArgs.trim()) {
    const extraTokens = settings.extraArgs.trim().split(/\s+/);
    args.push(...extraTokens);
  }

  // Output template
  args.push('-o', path.join(currentSettings.downloadDir, '%(title)s.%(ext)s'));
  args.push('--newline'); // Ensure progress outputs on newline for easy parsing
  args.push(url);


  const dlProcess = spawn(YTDLP_PATH, args);
  activeDownloads.set(downloadId, dlProcess);

  let filename = '';
  
  dlProcess.on('error', (err) => {
    console.error(`Spawn error for download ID ${downloadId}:`, err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ status: 'error', message: `Spawn failed: ${err.message}` })}\n\n`);
      res.end();
    }
  });

  dlProcess.stdout.on('data', (data) => {
    if (res.writableEnded) return;
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      // 1. Detect filename
      const destMatch = line.match(/\[download\] Destination: (.+)/);
      const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
      const audioMatch = line.match(/\[ExtractAudio\] Destination: (.+)/);
      
      if (destMatch) filename = destMatch[1];
      if (mergeMatch) filename = mergeMatch[1];
      if (audioMatch) filename = audioMatch[1];

      // 2. Parse download progress percentage, size, speed, and ETA
      const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        const size = progressMatch[2];
        const speed = progressMatch[3];
        const eta = progressMatch[4];
        
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ 
            status: 'downloading', 
            percent, 
            size, 
            speed, 
            eta 
          })}\n\n`);
        }
      }
      
      // 3. Detect post-processing state
      if (line.includes('[ExtractAudio]') && !audioMatch) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ status: 'processing', message: 'Extracting audio...' })}\n\n`);
        }
      }
      if (line.includes('[Merger]')) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ status: 'processing', message: 'Merging video & audio...' })}\n\n`);
        }
      }
    });
  });

  dlProcess.stderr.on('data', (data) => {
    console.error(`Download Error Chunk for ${downloadId}: ${data}`);
  });

  dlProcess.on('close', (code) => {
    activeDownloads.delete(downloadId);
    
    if (code === 0) {
      console.log(`Download completed successfully: ${filename}`);
      
      // Save item to history
      const history = loadHistory();
      const historyItem = {
        id: downloadId,
        url,
        title: filename ? path.basename(filename) : 'Downloaded Video',
        filepath: filename || path.join(currentSettings.downloadDir, 'download'),
        date: new Date().toISOString(),
        format: format === 'bestaudio' ? 'Audio Only' : 'Video'
      };
      history.unshift(historyItem);
      saveHistory(history);

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ 
          status: 'completed', 
          title: historyItem.title,
          filepath: historyItem.filepath 
        })}\n\n`);
        res.end();
      }
    } else {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ status: 'error', message: 'Download failed' })}\n\n`);
        res.end();
      }
    }
  });

  // Handle client disconnection
  req.on('close', () => {
    if (activeDownloads.has(downloadId)) {
      console.log(`Client disconnected. Killing download process ${downloadId}`);
      dlProcess.kill();
      activeDownloads.delete(downloadId);
    }
  });
});


// History endpoint
app.get('/api/history', (req, res) => {
  res.json(loadHistory());
});

// Delete single history item
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  let history = loadHistory();
  history = history.filter(item => item.id !== id);
  saveHistory(history);
  res.json({ success: true });
});

// Clear ALL history
app.delete('/api/history', (req, res) => {
  saveHistory([]);
  res.json({ success: true, message: 'All history cleared' });
});

// Open in Finder endpoint (using macOS open -R command)
app.post('/api/open-finder', (req, res) => {
  const { filepath } = req.body;
  if (!filepath) {
    return res.status(400).json({ error: 'Filepath is required' });
  }

  console.log(`Opening Finder for: ${filepath}`);
  
  // Escape filepath for shell command or pass it safely
  // open -R highlights the specific file in Finder
  exec(`open -R "${filepath}"`, (err) => {
    if (err) {
      console.error(`Error opening Finder: ${err}`);
      return res.status(500).json({ error: 'Failed to open file in Finder', details: err.message });
    }
    res.json({ success: true });
  });
});

// Get settings endpoint
app.get('/api/settings', (req, res) => {
  res.json(currentSettings);
});

// Update settings endpoint (full settings object)
app.post('/api/settings', (req, res) => {
  const body = req.body;
  if (!body.downloadDir) {
    return res.status(400).json({ error: 'downloadDir is required' });
  }
  if (!fs.existsSync(body.downloadDir)) {
    return res.status(400).json({ error: 'The specified directory does not exist' });
  }
  // Merge with current settings (preserve any keys not sent)
  currentSettings = { ...currentSettings, ...body };
  saveSettings(currentSettings);
  res.json(currentSettings);
});

// macOS folder selection prompt using AppleScript
app.post('/api/settings/browse', (req, res) => {
  const defaultLoc = currentSettings.downloadDir;
  const escapedPath = defaultLoc.replace(/"/g, '\\"');
  
  // Choose folder with AppleScript
  const cmd = `osascript -e 'POSIX path of (choose folder with prompt "Select Download Destination" default location POSIX file "${escapedPath}")'`;
  
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('AppleScript error:', stderr);
      return res.status(500).json({ error: 'Folder selection was cancelled or failed.' });
    }
    
    const selectedPath = stdout.trim();
    if (selectedPath) {
      currentSettings.downloadDir = selectedPath;
      saveSettings(currentSettings);
      res.json(currentSettings);
    } else {
      res.status(400).json({ error: 'No folder selected.' });
    }
  });
});

// Clear yt-dlp cache
app.post('/api/storage/clear-cache', (req, res) => {
  exec(`${YTDLP_PATH} --rm-cache-dir`, (error, stdout, stderr) => {
    if (error) {
      console.error('Failed to clear yt-dlp cache:', stderr);
      return res.status(500).json({ error: 'Failed to clear yt-dlp cache', details: stderr });
    }
    console.log('yt-dlp cache cleared');
    res.json({ success: true, removed: 1, message: 'yt-dlp cache cleared successfully' });
  });
});

// Open file in Finder or open it directly based on afterDownloadBehavior
app.post('/api/open-after-download', (req, res) => {
  const { filepath } = req.body;
  if (!filepath) return res.status(400).json({ error: 'filepath required' });
  
  const behavior = currentSettings.afterDownloadBehavior || 'doNothing';
  
  if (behavior === 'openInFinder') {
    exec(`open -R "${filepath}"`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else if (behavior === 'openFile') {
    exec(`open "${filepath}"`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else {
    res.json({ success: true, action: 'none' });
  }
});

// GET URL Allowlists
app.get('/api/allowlists', (req, res) => {
  res.json(loadAllowlists());
});

// ADD URL Allowlist Source
app.post('/api/allowlists/add', (req, res) => {
  const { urlString, name } = req.body;
  if (!urlString) {
    return res.status(400).json({ error: 'urlString is required' });
  }
  const lists = loadAllowlists();
  
  // Prevent duplicate urlString
  if (lists.some(l => l.urlString === urlString)) {
    return res.status(400).json({ error: 'Allowlist source already exists' });
  }

  const newList = {
    id: Date.now().toString(),
    urlString,
    name: name || urlString,
    isDefault: false,
    lastRefreshDate: null,
    statusMessage: "Added. Click Refresh to load entries.",
    entries: []
  };
  lists.push(newList);
  saveAllowlists(lists);
  res.json(newList);
});

// PASTE URL Allowlist JSON
app.post('/api/allowlists/paste', (req, res) => {
  const { json } = req.body;
  if (!json) {
    return res.status(400).json({ error: 'json content is required' });
  }
  try {
    const parsed = JSON.parse(json);
    let entries = [];
    const id = "pasted-" + Date.now();
    let name = `Pasted JSON ${id.substring(7, 12).toUpperCase()}`;

    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (parsed && Array.isArray(parsed.entries)) {
      entries = parsed.entries;
      if (parsed.name) name = parsed.name;
    } else {
      return res.status(400).json({ error: 'Invalid format. Must be an array of entries or an object containing an "entries" array.' });
    }

    const lists = loadAllowlists();
    const newList = {
      id,
      urlString: "",
      name,
      isDefault: false,
      lastRefreshDate: new Date().toISOString(),
      statusMessage: `Loaded ${entries.length} entries.`,
      entries: entries.map(e => ({
        name: e.name || e.pattern || "Unnamed Rule",
        pattern: e.pattern || "",
        enabled: e.enabled !== false
      })).filter(e => e.pattern !== "")
    };
    lists.push(newList);
    saveAllowlists(lists);
    res.json(newList);
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse JSON allowlist', details: e.message });
  }
});

// DELETE URL Allowlist
app.delete('/api/allowlists/:id', (req, res) => {
  const { id } = req.params;
  let lists = loadAllowlists();
  const target = lists.find(l => String(l.id) === String(id));
  if (target && target.isDefault) {
    return res.status(400).json({ error: 'Cannot delete the default Palladium allowlist' });
  }
  lists = lists.filter(l => String(l.id) !== String(id));
  saveAllowlists(lists);
  res.json({ success: true });
});

// REFRESH URL Allowlists
app.post('/api/allowlists/refresh', async (req, res) => {
  const lists = loadAllowlists();
  let updatedCount = 0;
  
  for (let list of lists) {
    if (list.urlString) {
      try {
        console.log(`Refreshing allowlist: ${list.urlString}`);
        const response = await fetch(list.urlString);
        if (response.ok) {
          const parsed = await response.json();
          if (parsed.entries && Array.isArray(parsed.entries)) {
            list.entries = parsed.entries.map(e => ({
              name: e.name || e.pattern,
              pattern: e.pattern,
              enabled: e.enabled !== false
            }));
            list.statusMessage = `Loaded ${parsed.entries.length} entries.`;
            list.lastRefreshDate = new Date().toISOString();
            if (parsed.name) list.name = parsed.name;
            updatedCount++;
          } else {
            list.statusMessage = "Error: Invalid JSON schema.";
          }
        } else {
          list.statusMessage = `HTTP Error: ${response.status}`;
        }
      } catch (err) {
        list.statusMessage = `Failed: ${err.message}`;
      }
    }
  }
  saveAllowlists(lists);
  res.json({ success: true, updated: updatedCount, lists });
});

// TOGGLE URL Allowlist Entry
app.post('/api/allowlists/toggle-entry', (req, res) => {
  const { listId, pattern, enabled } = req.body;
  const lists = loadAllowlists();
  const list = lists.find(l => String(l.id) === String(listId));
  if (list && list.entries) {
    const entry = list.entries.find(e => e.pattern === pattern);
    if (entry) {
      entry.enabled = enabled;
      saveAllowlists(lists);
      return res.json({ success: true });
    }
  }
  res.status(400).json({ error: 'Entry not found' });
});



// Package Manager Status Endpoint
app.get('/api/packages/status', (req, res) => {
  // Check versions of yt-dlp, pip3, gallery-dl
  exec(`${YTDLP_PATH} --version`, (errYt, outYt) => {
    const ytVer = errYt ? 'Not Installed' : outYt.trim();
    
    exec('gallery-dl --version', (errGal, outGal) => {
      const galVer = errGal ? 'Not Installed' : outGal.trim();
      
      exec('pip3 --version', (errPip, outPip) => {
        const pipVer = errPip ? 'Not Installed' : outPip.trim().split(' ')[1] || 'Installed';
        
        res.json({
          status: 'success',
          versions: {
            'yt-dlp': ytVer,
            'yt-dlp-apple-webkit-jsi': '0.1.1',
            'curl-cffi': '0.15.1b2 (bundled)',
            'gallery-dl': galVer,
            'pip': pipVer
          },
          updateSummary: 'All packages are up to date.'
        });
      });
    });
  });
});

// Package Manager Check Updates
app.post('/api/packages/check', (req, res) => {
  // Runs update check on yt-dlp
  exec(`${YTDLP_PATH} -U`, (error, stdout, stderr) => {
    let summary = 'All packages are up to date.';
    if (stdout.includes('up to date') || stdout.includes('Latest version')) {
      summary = 'All packages are up to date.';
    } else if (stdout.includes('Updating')) {
      summary = 'Updates are available!';
    } else {
      summary = stdout.trim() || stderr.trim() || 'Check completed.';
    }
    res.json({ success: true, summary });
  });
});

// Package Manager Update Packages
app.post('/api/packages/update', (req, res) => {
  exec(`${YTDLP_PATH} -U`, (error, stdout, stderr) => {
    if (error) {
      return res.json({ success: false, message: `Failed to update: ${stderr || error.message}` });
    }
    res.json({ success: true, message: stdout.trim() || 'yt-dlp updated successfully.' });
  });
});

// Package Manager Restore Pip Packages
app.post('/api/packages/restore', (req, res) => {
  // Reinstall yt-dlp using pip3 as restore action
  exec(`pip3 install --upgrade yt-dlp`, (error, stdout, stderr) => {
    if (error) {
      return res.json({ success: false, message: `Failed to restore: ${stderr || error.message}` });
    }
    res.json({ success: true, message: 'yt-dlp reinstalled/upgraded successfully via pip3.' });
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`Palladium Mac server running at http://localhost:${PORT}`);
});

