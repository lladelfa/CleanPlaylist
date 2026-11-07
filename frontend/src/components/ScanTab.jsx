import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  FileText,
  RefreshCw,
  Save,
  Trash2,
  Library,
} from "lucide-react";

import SavePlaylistModal from "./SavePlaylistModal";
import PlaylistPickerModal from "./PlaylistPickerModal";
import SmartInputBar from "./SmartInputBar";
import NoticeBanner from "./NoticeBanner";
import PasteTrackListPanel from "./PasteTrackListPanel";
import PlatformSwitchModal from "./PlatformSwitchModal";
import WorkingListWorkbench from "./WorkingListWorkbench";
import ScreeningControlsBar from "./ScreeningControlsBar";
import { reevaluateTracks } from "../utils/lyricEvaluator";
import { runScreeningPipeline } from "../utils/screeningPipeline";

export default function ScanTab({
  playlist,
  setPlaylist,
  scannedTracks,
  setScannedTracks,
  workingList = [],
  setWorkingList,
  lyricsByTrackId = {},
  setLyricsByTrackId,
  onOpenLyrics,
  customBlocklist,
  setCustomBlocklist,
  preset,
  setPreset,
  presetsData = null,
  isAuthenticated,
  onOpenAuth,
  activePlatform = "spotify",
  onSwitchPlatform,
  onRequestPlatformChange,
  keptTrackIds,
  onKeepTrack,
}) {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'flagged' | 'clean'
  const [searchQuery, setSearchQuery] = useState("");
  const [cleanCandidates, setCleanCandidates] = useState({});
  const [searchingClean, setSearchingClean] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeNotice, setActiveNotice] = useState(null);
  const [scanProgressAnnouncement, setScanProgressAnnouncement] = useState("");

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteInitialText, setPasteInitialText] = useState('');
  const [isResolvingPaste, setIsResolvingPaste] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState(null);

  const currentTracks = workingList && workingList.length > 0 ? workingList : scannedTracks;
  const currentTracksRef = useRef(currentTracks);
  useEffect(() => {
    currentTracksRef.current = workingList && workingList.length > 0 ? workingList : scannedTracks;
  }, [workingList, scannedTracks]);

  const handleAddSong = (song) => {
    const activeTracks = currentTracksRef.current;

    if (activeTracks.some((t) => t.id === song.id)) {
      setActiveNotice({
        type: "caution",
        message: `"${song.title}" is already in Working List.`,
      });
      return;
    }

    if (activeTracks.length >= 50) {
      setActiveNotice({
        type: "caution",
        message: "Working list is at capacity (50 tracks maximum).",
      });
      return;
    }

    const newTrack = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      artists_list: song.artists_list || [song.artist],
      album: song.album || "",
      duration: song.duration || "",
      duration_seconds: song.duration_seconds || 0,
      is_explicit: Boolean(song.is_explicit),
      thumbnail: song.thumbnail || "",
      video_url: song.video_url || "",
      verification_status: "unscanned",
      source_platform: activePlatform,
      is_flagged: Boolean(song.is_explicit),
      reasons: song.is_explicit
        ? [`Marked Explicit by ${activePlatform === "spotify" ? "Spotify" : "YouTube Music"}`]
        : [],
      detected_terms: [],
      snippets: [],
      has_lyrics: false,
    };

    setScannedTracks((prev) => [...prev, newTrack]);

    if (!playlist) {
      setPlaylist({
        id: "working_list",
        title: "Working List",
        author: "User",
        tracks: [newTrack],
      });
    } else {
      setPlaylist((prev) => ({
        ...prev,
        tracks: [...(prev.tracks || []), newTrack],
      }));
    }
  };

  const handleAddAlbum = async (album) => {
    try {
      const res = await fetch("/api/catalog/album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          album_id: album.id,
          platform: activePlatform,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to fetch album tracks");
      }

      const data = await res.json();
      const activeTracks = currentTracksRef.current;
      const remaining = 50 - activeTracks.length;

      if (remaining <= 0) {
        setActiveNotice({
          type: "caution",
          message: "Working list is at capacity (50 tracks maximum).",
        });
        return;
      }

      const rawTracks = data.tracks || [];
      const existingIds = new Set(activeTracks.map((t) => t.id));
      const dedupedTracks = rawTracks.filter((t) => !existingIds.has(t.id));

      if (dedupedTracks.length === 0) {
        setActiveNotice({
          type: "caution",
          message: `All tracks from "${album.title}" are already in Working List.`,
        });
        return;
      }

      const normalizedTracks = dedupedTracks.map((t) => ({
        ...t,
        verification_status: "unscanned",
        source_platform: activePlatform,
        is_flagged: Boolean(t.is_explicit),
        reasons: t.is_explicit
          ? [`Marked Explicit by ${activePlatform === "spotify" ? "Spotify" : "YouTube Music"}`]
          : [],
        detected_terms: [],
        snippets: [],
        has_lyrics: false,
      }));

      if (normalizedTracks.length > remaining) {
        const toAdd = normalizedTracks.slice(0, remaining);
        const omittedCount = normalizedTracks.length - remaining;

        setScannedTracks((prev) => [...prev, ...toAdd]);
      currentTracksRef.current = [...activeTracks, ...toAdd];

        if (!playlist) {
          setPlaylist({
            id: album.id,
            title: album.title,
            author: album.artist,
            tracks: toAdd,
          });
        } else {
          setPlaylist((prev) => ({
            ...prev,
            tracks: [...(prev.tracks || []), ...toAdd],
          }));
        }

        setActiveNotice({
          type: "caution",
          message: `Added ${remaining} tracks from "${album.title}". Working list capped at 50 tracks (${omittedCount} tracks omitted).`,
        });
      } else {
        setScannedTracks((prev) => [...prev, ...normalizedTracks]);

        if (!playlist) {
          setPlaylist({
            id: album.id,
            title: album.title,
            author: album.artist,
            tracks: normalizedTracks,
          });
        } else {
          setPlaylist((prev) => ({
            ...prev,
            tracks: [...(prev.tracks || []), ...normalizedTracks],
          }));
        }

        setActiveNotice({
          type: "success",
          message: `Added ${normalizedTracks.length} tracks from "${album.title}".`,
        });
      }
    } catch (err) {
      setActiveNotice({
        type: "error",
        message: err.message || "Failed to load album tracks",
      });
    }
  };

  const handleOpenPastePanel = (initialText = "") => {
    setPasteInitialText(typeof initialText === "string" ? initialText : "");
    setIsPasteOpen(true);
  };

  const handleTriggerPlatformSwitch = (targetPlatform) => {
    if (onRequestPlatformChange) {
      onRequestPlatformChange(targetPlatform);
      return;
    }
    const activeTracks = currentTracksRef.current;
    if (activeTracks && activeTracks.length > 0) {
      setPendingPlatform(targetPlatform);
      setIsSwitchModalOpen(true);
    } else {
      if (onSwitchPlatform) onSwitchPlatform(targetPlatform);
    }
  };

  const handleConfirmPlatformSwitch = () => {
    setScannedTracks([]);
    if (setWorkingList) setWorkingList([]);
    setPlaylist(null);
    setIsSwitchModalOpen(false);
    if (onSwitchPlatform) onSwitchPlatform(pendingPlatform);
    setPendingPlatform(null);
  };

  const handleCancelPlatformSwitch = () => {
    setIsSwitchModalOpen(false);
    setPendingPlatform(null);
  };

  const handleResolvePaste = async (linesToResolve) => {
    if (!linesToResolve || linesToResolve.length === 0) return;

    const activeTracks = currentTracksRef.current;
    const remainingSlots = 50 - activeTracks.length;
    if (remainingSlots <= 0) {
      setActiveNotice({
        type: "caution",
        message: "Working list is at capacity (50 tracks maximum).",
      });
      return;
    }

    setIsResolvingPaste(true);

    const BATCH_SIZE = 15;
    const chunks = [];
    for (let i = 0; i < linesToResolve.length; i += BATCH_SIZE) {
      chunks.push(linesToResolve.slice(i, i + BATCH_SIZE));
    }

    const allResolved = [];
    const allUnresolved = [];

    try {
      for (const chunk of chunks) {
        const res = await fetch("/api/catalog/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: chunk,
            platform: activePlatform,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.resolved)) {
            allResolved.push(...data.resolved);
          }
          if (Array.isArray(data.unresolved)) {
            allUnresolved.push(...data.unresolved);
          }
        } else {
          chunk.forEach((l) => allUnresolved.push({ line: l, reason: "error" }));
        }
      }
    } catch (err) {
      console.error("Paste resolution error:", err);
    } finally {
      setIsResolvingPaste(false);
      setIsPasteOpen(false);
    }

    const existingIds = new Set(activeTracks.map((t) => t.id));

    const seenIds = new Set(existingIds);
    const dedupedResolved = allResolved.filter((t) => !seenIds.has(t.id) && seenIds.add(t.id));

    let toAdd = [];
    if (dedupedResolved.length > 0 && remainingSlots > 0) {
      toAdd = dedupedResolved.slice(0, remainingSlots).map((t) => ({
        ...t,
        verification_status: "unscanned",
        source_platform: activePlatform,
        is_flagged: Boolean(t.is_explicit),
        reasons: t.is_explicit
          ? [`Marked Explicit by ${activePlatform === "spotify" ? "Spotify" : "YouTube Music"}`]
          : [],
        detected_terms: [],
        snippets: [],
        has_lyrics: false,
      }));

      setScannedTracks((prev) => [...prev, ...toAdd]);

      if (!playlist) {
        setPlaylist({
          id: "working_list",
          title: "Working List",
          author: "User",
          tracks: toAdd,
        });
      } else {
        setPlaylist((prev) => ({
          ...prev,
          tracks: [...(prev.tracks || []), ...toAdd],
        }));
      }
    }

    const wrongPlatformItems = allUnresolved.filter((item) => item.reason === "wrong_platform");
    const failedItems = allUnresolved.filter((item) => item.reason !== "wrong_platform");
    if (wrongPlatformItems.length > 0) {
      const targetPlatform = wrongPlatformItems[0].target_platform || (activePlatform === "spotify" ? "ytmusic" : "spotify");
      const targetLabel = targetPlatform === "spotify" ? "Spotify" : "YouTube Music";

      setActiveNotice({
        type: "caution",
        message: `${wrongPlatformItems.length} track URL${wrongPlatformItems.length > 1 ? "s are" : " is"} for ${targetLabel} and ${wrongPlatformItems.length > 1 ? "were" : "was"} skipped.`,
        actionLabel: `Switch to ${targetLabel}`,
        onAction: () => handleTriggerPlatformSwitch(targetPlatform),
      });
    } else if (allResolved.length === 0 && allUnresolved.length > 0) {
      setActiveNotice({
        type: "caution",
        message: "No matching tracks could be resolved from the pasted list.",
      });
    } else if (failedItems.length > 0) {
      setActiveNotice({
        type: "caution",
        message: `Added ${toAdd.length} track${toAdd.length !== 1 ? "s" : ""}. ${failedItems.length} line${failedItems.length !== 1 ? "s" : ""} could not be resolved.`,
      });
    } else if (dedupedResolved.length > remainingSlots) {
      setActiveNotice({
        type: "caution",
        message: `Added ${remainingSlots} tracks. Working list capped at 50 tracks (${dedupedResolved.length - remainingSlots} tracks omitted).`,
      });
    }
  };

  // Sample playlists for instant testing
  const samplePlaylists = [
    {
      label: "Top Hits Sample",
      url: "https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk",
    },
    {
      label: "Popular Pop",
      url: "https://music.youtube.com/playlist?list=PLGW0Is3f0CKuxqGlK13w5h4r-62mHJR1Y",
    },
  ];

  const handleFetchPlaylist = async (urlToFetch) => {
    const targetUrl = urlToFetch || urlInput;
    if (!targetUrl.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/playlist/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_or_id: targetUrl,
          limit: 100,
          platform: activePlatform,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch playlist");
      }
      const data = await res.json();
      setPlaylist(data);
      // Initialize scanned tracks with default explicit tag
      const initial = data.tracks.map((t) => ({
        ...t,
        is_flagged: t.is_explicit,
        reasons: t.is_explicit ? ["Marked Explicit by YouTube Music"] : [],
        detected_terms: [],
        snippets: [],
        has_lyrics: false,
      }));
      setScannedTracks(initial);
      setStatusMessage({
        type: "success",
        text: `Loaded "${data.title}" with ${data.tracks.length} tracks.`,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    if (scanning) return;
    const targetTracks = workingList && workingList.length > 0 ? workingList : scannedTracks;
    if (!targetTracks || !targetTracks.length) return;

    setScanning(true);
    setStatusMessage(null);
    setScanProgressAnnouncement(`Scanned 0 of ${targetTracks.length} tracks`);

    try {
      const result = await runScreeningPipeline({
        tracks: targetTracks,
        preset,
        customBlocklist,
        platform: activePlatform,
        onBatchStart: (chunk) => {
          const chunkIds = new Set(chunk.map((t) => t.id));
          setScannedTracks((prev) =>
            prev.map((t) => (chunkIds.has(t.id) ? { ...t, verification_status: "scanning" } : t))
          );
        },
        onProgress: ({ announcement }) => {
          setScanProgressAnnouncement(announcement);
        },
        onBatchComplete: ({ tracks: batchTracks, lyricsById: batchLyrics }) => {
          const updatedMap = new Map(batchTracks.map((t) => [t.id, t]));
          setScannedTracks((prev) =>
            prev.map((t) => (updatedMap.has(t.id) ? { ...t, ...updatedMap.get(t.id) } : t))
          );

          if (setLyricsByTrackId && batchLyrics && Object.keys(batchLyrics).length > 0) {
            setLyricsByTrackId((prev) => ({ ...prev, ...batchLyrics }));
          }
        },
        onError: (err) => {
          setActiveNotice({
            type: "caution",
            message: `Scan batch failed: ${err.message}`,
          });
        },
      });

      if (playlist && setPlaylist) {
        const updatedMap = new Map((result.tracks || []).map((t) => [t.id, t]));
        setPlaylist((prev) => (prev ? {
          ...prev,
          tracks: (prev.tracks || []).map((t) => (updatedMap.has(t.id) ? { ...t, ...updatedMap.get(t.id) } : t)),
        } : prev));
      }

      const totalScanned = result.tracks?.length || 0;
      const allErrors = totalScanned > 0 && result.tracks.every((t) => t.verification_status === "scan_error");

      if (allErrors) {
        const errorText = "Scan failed: All tracks encountered scanning errors.";
        setStatusMessage({
          type: "error",
          text: errorText,
        });
        setScanProgressAnnouncement(errorText);
      } else {
        const flaggedCount = (result.tracks || []).filter((t) => t.is_flagged).length;
        const summaryText = `Scan complete: ${flaggedCount} flagged tracks found out of ${totalScanned} tracks.`;
        setStatusMessage({
          type: "success",
          text: summaryText,
        });
        setScanProgressAnnouncement(summaryText);
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleFindClean = async (track) => {
    setSearchingClean((prev) => ({ ...prev, [track.id]: true }));
    try {
      const res = await fetch("/api/replacements/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          duration_seconds: track.duration_seconds || 0,
          platform: activePlatform,
        }),
      });
      const data = await res.json();
      if (data.found && data.clean_candidate) {
        setCleanCandidates((prev) => ({
          ...prev,
          [track.id]: data.clean_candidate,
        }));
      } else {
        setCleanCandidates((prev) => ({ ...prev, [track.id]: "none" }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingClean((prev) => ({ ...prev, [track.id]: false }));
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          tracks: scannedTracks,
          playlist_title: playlist?.title || "CleanPlaylist",
        }),
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${playlist?.title || "CleanPlaylist"}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert("Failed to export: " + err.message);
    }
  };

  const handleSwapTrack = (originalTrack, cleanTrack) => {
    const swapFn = (t) => {
      if (t.id === originalTrack.id) {
        return {
          ...cleanTrack,
          is_flagged: false,
          reasons: [],
          is_explicit: false,
          was_replaced: true,
          original_title: originalTrack.title,
          original_id: originalTrack.id,
          original_set_video_id: originalTrack.setVideoId,
        };
      }
      return t;
    };

    setScannedTracks((prev) => prev.map(swapFn));
    if (setWorkingList) {
      setWorkingList((prev) => prev.map(swapFn));
    }
    setCleanCandidates((prev) => {
      const updated = { ...prev };
      delete updated[originalTrack.id];
      return updated;
    });
  };

  const reevaluateWith = useCallback((newPreset, newBlocklist) => {
    const activePreset = newPreset !== undefined ? newPreset : preset;
    const activeBlocklist = newBlocklist !== undefined ? newBlocklist : customBlocklist;
    const targetTracks = workingList && workingList.length > 0 ? workingList : scannedTracks;
    if (!targetTracks || targetTracks.length === 0) return;

    try {
      const { tracks: evaluatedTracks } = reevaluateTracks(targetTracks, {
        lyricsByTrackId,
        preset: activePreset,
        customBlocklist: activeBlocklist,
        presets: presetsData?.presets
          ? Object.fromEntries(presetsData.presets.map((p) => [p.id, p]))
          : undefined,
        categories: presetsData?.categories,
        suffixPattern: presetsData?.morphological_suffix_pattern,
        platform: activePlatform,
      });

      setScannedTracks(evaluatedTracks);
      if (setWorkingList) {
        setWorkingList(evaluatedTracks);
      }
      if (playlist && setPlaylist) {
        setPlaylist((prev) => (prev ? { ...prev, tracks: evaluatedTracks } : prev));
      }
    } catch (err) {
      console.error("Failed to re-evaluate tracks client-side:", err);
    }
  }, [preset, customBlocklist, workingList, scannedTracks, lyricsByTrackId, presetsData, activePlatform, setScannedTracks, setWorkingList, playlist, setPlaylist]);

  const lastScreeningConfigRef = useRef({ preset, customBlocklist, presetsData });
  useEffect(() => {
    if (
      lastScreeningConfigRef.current.preset !== preset ||
      lastScreeningConfigRef.current.customBlocklist !== customBlocklist ||
      lastScreeningConfigRef.current.presetsData !== presetsData
    ) {
      lastScreeningConfigRef.current = { preset, customBlocklist, presetsData };
      reevaluateWith(preset, customBlocklist);
    }
  }, [preset, customBlocklist, presetsData, reevaluateWith]);

  const handleSelectPreset = (newPreset) => {
    lastScreeningConfigRef.current = { preset: newPreset, customBlocklist };
    setPreset(newPreset);
    reevaluateWith(newPreset, customBlocklist);
  };

  const handleAddBlocklistTerm = (term) => {
    const currentList = Array.isArray(customBlocklist) ? customBlocklist : [];
    const next = [...currentList, term];
    lastScreeningConfigRef.current = { preset, customBlocklist: next };
    setCustomBlocklist(next);
    reevaluateWith(preset, next);
  };

  const handleRemoveBlocklistTerm = (term) => {
    const currentList = Array.isArray(customBlocklist) ? customBlocklist : [];
    const next = currentList.filter((w) => w !== term);
    lastScreeningConfigRef.current = { preset, customBlocklist: next };
    setCustomBlocklist(next);
    reevaluateWith(preset, next);
  };

  const handleRemoveTrack = (trackToRemove) => {
    setScannedTracks((prev) => prev.filter((t) => t.id !== trackToRemove.id));
    if (setWorkingList) {
      setWorkingList((prev) => prev.filter((t) => t.id !== trackToRemove.id));
    }
    setCleanCandidates((prev) => {
      const updated = { ...prev };
      delete updated[trackToRemove.id];
      return updated;
    });
  };

  const handleClearList = () => {
    setScannedTracks([]);
    if (setWorkingList) {
      setWorkingList([]);
    }
    setPlaylist(null);
    setCleanCandidates({});
  };

  // Filtered tracks
  const displayedTracks = scannedTracks.filter((t) => {
    const matchesFilter =
      filterMode === "all" ||
      (filterMode === "flagged" && t.is_flagged) ||
      (filterMode === "clean" && !t.is_flagged);

    const matchesSearch =
      searchQuery === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const flaggedCount = scannedTracks.filter((t) => t.is_flagged).length;
  const cleanCount = scannedTracks.length - flaggedCount;
  const initialTrackCount = playlist?.tracks?.length ?? scannedTracks.length;
  const removedCount = Math.max(0, initialTrackCount - scannedTracks.length);

  return (
    <div className="space-y-6">
      {/* 0. Notice Banner */}
      {activeNotice && (
        <NoticeBanner
          type={activeNotice.type}
          message={activeNotice.message}
          actionLabel={activeNotice.actionLabel}
          onAction={activeNotice.onAction}
          onDismiss={() => setActiveNotice(null)}
        />
      )}

      {/* 1. Smart Input Bar */}
      <SmartInputBar
        activePlatform={activePlatform}
        onAddSong={handleAddSong}
        onAddAlbum={handleAddAlbum}
        onOpenPastePanel={handleOpenPastePanel}
        vipMode={isAuthenticated}
      />

      {/* 1.1 Paste Track List Panel */}
      <PasteTrackListPanel
        isOpen={isPasteOpen}
        initialText={pasteInitialText}
        onClose={() => setIsPasteOpen(false)}
        onResolve={handleResolvePaste}
        isLoading={isResolvingPaste}
      />

      {/* Legacy / Direct Playlist Input Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          YouTube Music Playlist URL or Playlist ID
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. https://music.youtube.com/playlist?list=PL... or PL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
          {activePlatform === "spotify" && isAuthenticated && (
            <button
              type="button"
              onClick={() => setIsPickerModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-green-400 border border-slate-700 font-medium text-sm rounded-xl transition"
            >
              <Library className="w-4 h-4" />
              <span>Browse Library</span>
            </button>
          )}
          <button
            onClick={() => handleFetchPlaylist()}
            disabled={loading}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-purple-600/30 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span>{loading ? "Fetching..." : "Load Playlist"}</span>
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="mt-3 flex items-center space-x-2 text-xs text-slate-400 flex-wrap gap-2">
          <span>Try a sample:</span>
          {samplePlaylists.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUrlInput(sample.url);
                handleFetchPlaylist(sample.url);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-purple-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border text-sm flex items-center space-x-2 ${
              statusMessage.type === "error"
                ? "bg-red-950/40 border-red-800 text-red-300"
                : "bg-emerald-950/40 border-emerald-800 text-emerald-300"
            }`}
          >
            {statusMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>


      {/* 2. Screening Controls Bar (shown when playlist loaded) */}
      {(playlist || scannedTracks.length > 0) && (
        <ScreeningControlsBar
          preset={preset}
          onSelectPreset={handleSelectPreset}
          customBlocklist={customBlocklist}
          onAddBlocklistTerm={handleAddBlocklistTerm}
          onRemoveBlocklistTerm={handleRemoveBlocklistTerm}
          onRunScan={handleRunScan}
          scanning={scanning}
          scanProgressAnnouncement={scanProgressAnnouncement}
        />
      )}

      {/* 3. Scanned Tracks Results */}
      {(playlist || scannedTracks.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Header Stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{playlist?.title || "Working List"}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {playlist?.author ? `By ${playlist.author} • ` : ""}{scannedTracks.length} tracks total
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 bg-red-950/40 text-red-400 text-xs px-3 py-1.5 rounded-xl border border-red-900/50 hidden sm:flex">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold">{flaggedCount} Flagged</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-emerald-950/40 text-emerald-400 text-xs px-3 py-1.5 rounded-xl border border-emerald-900/50 hidden sm:flex">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">{cleanCount} Clean</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-slate-800/60 text-slate-300 text-xs px-3 py-1.5 rounded-xl border border-slate-700/60 hidden sm:flex">
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span className="font-semibold">{removedCount} Removed</span>
              </div>

              {activePlatform === "spotify" ? (
                isAuthenticated ? (
                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl flex items-center space-x-2 transition shadow"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to Spotify...</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center space-x-2 border border-slate-700 transition"
                  >
                    <Sparkles className="w-4 h-4 text-green-400" />
                    <span>Login to Save</span>
                  </button>
                )
              ) : (
                <button
                  onClick={() => handleExportCSV()}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl flex items-center space-x-2 transition shadow"
                >
                  <FileText className="w-4 h-4" />
                  <span>Export to CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Controls: Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setFilterMode("all")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === "all"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All ({scannedTracks.length})
              </button>
              <button
                onClick={() => setFilterMode("flagged")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === "flagged"
                    ? "bg-red-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Flagged ({flaggedCount})
              </button>
              <button
                onClick={() => setFilterMode("clean")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === "clean"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Clean ({cleanCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Working List Workbench */}
          {displayedTracks.length > 0 ? (
            <WorkingListWorkbench
              tracks={displayedTracks}
              onRemoveTrack={handleRemoveTrack}
              onClearList={handleClearList}
              onOpenLyrics={onOpenLyrics}
              cleanCandidates={cleanCandidates}
              searchingClean={searchingClean}
              onFindClean={handleFindClean}
              onSwapTrack={handleSwapTrack}
              keptTrackIds={keptTrackIds}
              onKeepTrack={onKeepTrack}
            />
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">
              No tracks match the selected filter.
            </div>
          )}
        </div>
      )}

      <SavePlaylistModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        playlist={playlist}
        displayedTracks={scannedTracks}
        activePlatform={activePlatform}
        onSaveSuccess={() => {
          setStatusMessage({
            type: "success",
            text: "Playlist saved successfully!",
          });
        }}
      />

      <PlaylistPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        onSelectPlaylist={(selectedUrl) => {
          setUrlInput(selectedUrl);
          handleFetchPlaylist(selectedUrl);
        }}
      />

      {!onRequestPlatformChange && (
        <PlatformSwitchModal
          isOpen={isSwitchModalOpen}
          targetPlatform={pendingPlatform}
          onConfirm={handleConfirmPlatformSwitch}
          onCancel={handleCancelPlatformSwitch}
        />
      )}
    </div>
  );
}
