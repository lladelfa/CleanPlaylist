# CleanPlaylist 🎵

> An intelligent web application that integrates with **YouTube Music** (Google's music platform) to identify songs with offensive language, search song lyrics for specific target keywords, find clean radio-edit substitutes, and stitch together multiple playlists.

---

## ✨ Features

- **YouTube Music Integration (Zero-Auth Ready)**: Paste any public or unlisted YouTube Music / YouTube playlist URL or ID (e.g. `https://music.youtube.com/playlist?list=...`) to immediately inspect and process tracks without needing API keys.
- **Offensive Language Detection**:
  - **Metadata Scan**: Detects native `Explicit (E)` tags on tracks.
  - **Deep Lyrics Scan**: Pulls song lyrics directly from YouTube Music and evaluates them against curated profanity lexicons and severity levels.
  - **Sensitivity Presets**:
    - **Moderate (Recommended)**: Filters explicit vulgarity, slurs, and strong profanity (allows mild terms like *damn*, *hell*).
    - **Kid-Safe / Strict**: Strict filter for all profanities, vulgarities, substance references, and crude humor.
    - **Slurs Only**: Flags only hate speech and derogatory terms.
    - **Custom Blocklist**: Add your own custom forbidden words or phrases.
- **Target Keyword Search & Identifier**:
  - Provide specific keywords or themes (e.g., `money`, `alcohol`, `party`, `gun`, or any custom word).
  - Searches song lyrics across the playlist, reporting exact occurrences, line numbers, and highlighted lyric snippets.
- **Smart Clean Replacement Finder**:
  - Automatically queries YouTube Music for non-explicit "Clean" or "Radio Edit" versions of flagged songs.
  - Compares title, artist, and song duration to suggest 1-click track swaps.
- **Playlist Stitcher Studio**:
  - Merge two or more playlists into a unified collection.
  - **Ordering modes**: Sequential, Interleaved (alternating tracks), Alphabetical by Title, or Alphabetical by Artist.
  - **Deduplication modes**: Exact YouTube video ID match, fuzzy Title + Artist match, or allow all.
  - **Clean Filtering Rules**:
    - *Auto-replace*: Swap explicit tracks with clean versions if found, drop if unavailable.
    - *Strict Clean*: Remove all explicit songs.
    - *Keep All*: Retain all songs while keeping track of flags.
- **Universal Export**:
  - Export the stitched and cleaned playlist to **M3U8** (for media players like VLC, Apple Music), **CSV** (for spreadsheets), or **JSON**.

---

## 🚀 Quick Start (Local)

### 1. Requirements
- Python 3.10+
- Node.js 18+ (for building frontend)

### 2. Setup & Launch
Clone or open the project folder in your terminal:

```bash
# If using the provided virtual environment:
.venv\Scripts\python.exe run.py

# Or on macOS/Linux:
# python3 run.py
```

Open your browser to: **[http://localhost:8000](http://localhost:8000)**

---

## 🌐 Deploying Online for Others to Use

CleanPlaylist is designed with a clean separation of concerns:
- **FastAPI backend** in `backend/app`
- **React + Tailwind CSS frontend** in `frontend/`

The backend is already configured to serve the compiled frontend (`frontend/dist`) as static files from the root route `/` on a single port.

### Deploying to Render / Railway / Fly.io:
1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
2. Start the FastAPI server using `uvicorn`:
   ```bash
   uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT
   ```

### Dockerfile (Optional):
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ /app/backend/
COPY frontend/dist/ /app/frontend/dist/
ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🔒 Adding Google OAuth (Future Enhancement)

The app currently uses public YouTube Music playlist lookups (requiring no user credentials).

To enable direct synchronization to private libraries or automatic playlist creation under a user's Google account:
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **YouTube Data API v3**.
2. Obtain OAuth 2.0 Client ID and Secret (`credentials.json`).
3. Use `ytmusicapi.setup_oauth()` or Google OAuth 2.0 Web Server flow in FastAPI to exchange authorization codes for access/refresh tokens.
4. Pass the authenticated token into `YTMusic(credentials)` in `ytmusic_service.py` to call `yt.create_playlist(...)` and `yt.add_playlist_items(...)`.

---

## 📁 Project Architecture

```
CleanPlaylist/
├── backend/
│   ├── app/
│   │   ├── config.py                  # Filter presets & word categories
│   │   ├── main.py                    # FastAPI application & API endpoints
│   │   └── services/
│   │       ├── scanner_service.py     # Offensive word & keyword scanner
│   │       ├── ytmusic_service.py     # YouTube Music API & lyrics client
│   │       └── stitcher_service.py    # Merging, deduplication & exports
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx             # Top navigation & logo
│   │   │   ├── ScanTab.jsx            # Playlist scanner & clean swap UI
│   │   │   ├── KeywordsTab.jsx        # Specific keyword identifier in lyrics
│   │   │   ├── StitchTab.jsx          # Playlist merger & export studio
│   │   │   └── LyricsModal.jsx        # Full lyric viewer with highlighted terms
│   │   ├── App.jsx                    # Root React component & state
│   │   └── index.css                  # Tailwind CSS v4 styling
│   ├── dist/                          # Compiled production frontend
│   └── package.json
├── run.py                             # One-click launcher script
└── README.md
```
