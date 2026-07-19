document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const navItems = document.querySelectorAll('.nav-item');
  const contentTabs = document.querySelectorAll('.content-tab');
  
  const urlInput = document.getElementById('url-input');
  const fetchBtn = document.getElementById('fetch-btn');
  const loadingSpinner = document.getElementById('loading-spinner');
  
  const detailsCard = document.getElementById('details-card');
  const videoThumbnail = document.getElementById('video-thumbnail');
  const videoTitle = document.getElementById('video-title');
  const videoUploader = document.getElementById('video-uploader');
  const videoDuration = document.getElementById('video-duration');
  const formatSelect = document.getElementById('format-select');
  const downloadBtn = document.getElementById('download-btn');
  
  const progressCard = document.getElementById('progress-card');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressTitle = document.getElementById('progress-title');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  const progressSpeed = document.getElementById('progress-speed');
  const progressSize = document.getElementById('progress-size');
  const progressEta = document.getElementById('progress-eta');
  
  const libraryEmpty = document.getElementById('library-empty');
  const libraryList = document.getElementById('library-list');

  // Currently fetched URL metadata
  let activeUrl = '';
  let activeTitle = '';

  // 1. Navigation / Tabs Switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle active nav class
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Toggle active tab panel
      const targetTab = item.dataset.tab;
      contentTabs.forEach(tab => {
        if (tab.id === `tab-${targetTab}`) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // Load library if switched to library tab
      if (targetTab === 'library') {
        loadLibrary();
      }
    });
  });

  // Helper: Format Duration (seconds to H:MM:SS or M:SS)
  function formatDuration(sec) {
    if (!sec) return '0:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // 2. Fetch Video Metadata
  fetchBtn.addEventListener('click', fetchVideoDetails);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchVideoDetails();
  });

  async function fetchVideoDetails() {
    const url = urlInput.value.trim();
    if (!url) {
      alert('Please paste a valid video URL first.');
      return;
    }

    // Reset UI states
    detailsCard.classList.add('hidden');
    progressCard.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    
    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (response.ok) {
        activeUrl = url;
        activeTitle = data.title;
        
        // Populate info
        videoThumbnail.src = data.thumbnail || 'https://via.placeholder.com/640x360?text=No+Thumbnail';
        videoTitle.textContent = data.title;
        videoUploader.textContent = data.uploader;
        videoDuration.textContent = formatDuration(data.duration);
        
        // Populate formats dropdown
        formatSelect.innerHTML = '';
        data.formats.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = f.label;
          formatSelect.appendChild(opt);
        });

        loadingSpinner.classList.add('hidden');
        detailsCard.classList.remove('hidden');
      } else {
        alert(data.error || 'Failed to fetch video details.');
        loadingSpinner.classList.add('hidden');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while communicating with the local server.');
      loadingSpinner.classList.add('hidden');
    }
  }

  // 3. Perform Download (using Server-Sent Events)
  downloadBtn.addEventListener('click', () => {
    const selectedFormat = formatSelect.value;
    
    // Hide details card, show progress card
    detailsCard.classList.add('hidden');
    progressCard.classList.remove('hidden');
    
    // Reset progress details
    progressTitle.textContent = activeTitle;
    progressBarFill.style.width = '0%';
    progressPercent.textContent = '0';
    progressStatus.textContent = 'Initiating download streams...';
    progressSpeed.textContent = '-';
    progressSize.textContent = '-';
    progressEta.textContent = '-';

    // Start SSE stream
    const eventSource = new EventSource(`/api/download/stream?url=${encodeURIComponent(activeUrl)}&format=${encodeURIComponent(selectedFormat)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status === 'downloading') {
        progressStatus.textContent = 'Downloading...';
        progressBarFill.style.width = `${data.percent}%`;
        progressPercent.textContent = Math.round(data.percent);
        progressSpeed.textContent = data.speed;
        progressSize.textContent = data.size;
        progressEta.textContent = data.eta;
      } 
      else if (data.status === 'processing') {
        progressStatus.textContent = data.message || 'Processing output...';
        progressBarFill.style.width = '100%';
        progressPercent.textContent = '99';
        progressSpeed.textContent = '-';
        progressEta.textContent = '-';
      }
      else if (data.status === 'completed') {
        eventSource.close();
        progressStatus.textContent = 'Download Complete! ✓';
        progressBarFill.style.width = '100%';
        progressPercent.textContent = '100';
        
        // Trigger after-download behavior (Open in Finder / Open File / Do Nothing)
        if (data.filepath) {
          fetch('/api/open-after-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: data.filepath })
          }).catch(() => {});
        }
        
        // Short delay to show completed status, then reset
        setTimeout(() => {
          progressCard.classList.add('hidden');
          urlInput.value = '';
          detailsCard.classList.add('hidden');
          loadLibrary(); // refresh library
        }, 2000);
      }

      else if (data.status === 'error') {
        eventSource.close();
        progressStatus.textContent = 'Download Failed!';
        progressStatus.style.color = '#ff5f56';
        alert(data.message || 'An error occurred during download.');
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE Error:', e);
      eventSource.close();
      progressStatus.textContent = 'Connection Lost!';
      progressStatus.style.color = '#ff5f56';
    };
  });

  // 4. Load Library Items
  async function loadLibrary() {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();

      if (data && data.length > 0) {
        libraryEmpty.classList.add('hidden');
        libraryList.classList.remove('hidden');
        
        libraryList.innerHTML = '';
        data.forEach(item => {
          const div = document.createElement('div');
          div.className = 'library-item';
          
          const formattedDate = new Date(item.date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          div.innerHTML = `
            <div class="lib-info">
              <span class="lib-title" title="${item.title}">${item.title}</span>
              <span class="lib-meta">
                <span>${item.format}</span>
                <span class="separator">•</span>
                <span>${formattedDate}</span>
              </span>
            </div>
            <div class="lib-actions">
              <button class="icon-btn finder-btn" title="Show in Finder">
                <svg class="action-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button class="icon-btn delete-btn" title="Remove from Library">
                <svg class="action-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          `;

          // Finder trigger
          div.querySelector('.finder-btn').addEventListener('click', () => {
            openInFinder(item.filepath);
          });

          // Delete trigger
          div.querySelector('.delete-btn').addEventListener('click', () => {
            deleteHistoryItem(item.id);
          });

          libraryList.appendChild(div);
        });
      } else {
        libraryEmpty.classList.remove('hidden');
        libraryList.classList.add('hidden');
      }
    } catch (e) {
      console.error('Error loading library:', e);
    }
  }

  // Helper: Open in Finder API call
  async function openInFinder(filepath) {
    try {
      const response = await fetch('/api/open-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath })
      });
      if (!response.ok) {
        const err = await response.json();
        alert(`Error opening file: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Helper: Delete history item API call
  async function deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to remove this item from your library history? (This will not delete the actual file)')) {
      return;
    }

    try {
      const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadLibrary();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Load library on startup
  loadLibrary();
});

