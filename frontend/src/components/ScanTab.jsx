import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  FileText,
  Save,
  Trash2,
} from "lucide-react";

import SavePlaylistModal from "./SavePlaylistModal";
import PlaylistPickerModal from "./PlaylistPickerModal";
import SmartInputBar from "./SmartInputBar";
import NoticeBanner from "./NoticeBanner";
import PasteTrackListPanel from "./PasteTrackListPanel";
import PlatformSwitchModal from "./PlatformSwitchModal";
import WorkingListWorkbench from "./WorkingListWorkbench";
import ScreeningControlsBar from "./ScreeningControlsBar";
import EmptyStateHero from "./EmptyStateHero";
import { reevaluateTracks } from "../utils/lyricEvaluator";
import { runScreeningPipeline, runBulkCleanPipeline } from "../utils/screeningPipeline";
import { isYouTubePlaylist, isSpotifyPlaylistUrl } from "../utils/inputParser";

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
  isMasked = true,
  onToggleMasking,
  cleanCandidates: externalCleanCandidates,
  setCleanCandidates: externalSetCleanCandidates,
}) {
  const [scanning, setScanning] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'flagged' | 'clean'
  const [searchQuery, setSearchQuery] = useState("");
  const [internalCleanCandidates, setInternalCleanCandidates] = useState({});
  const cleanCandidates = externalCleanCandidates ?? internalCleanCandidates;
  const setCleanCandidates = externalSetCleanCandidates ?? setInternalCleanCandidates;
  const [searchingClean, setSearchingClean] = useState({});
  const [bulkCleaning, setBulkCleaning] = useState(false);
  const [bulkCleanProgress, setBulkCleanProgress] = useState("");
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
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);

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
        if (setWorkingList) setWorkingList((prev) => [...prev, ...toAdd]);
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
        if (setWorkingList) setWorkingList((prev) => [...prev, ...normalizedTracks]);

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
    setCleanCandidates({});
    setSearchingClean({});
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

  const handleFetchPlaylist = async (urlToFetch) => {
    const targetUrl = urlToFetch;
    if (!targetUrl || !targetUrl.trim()) return;

    const targetPlatform = isYouTubePlaylist(targetUrl)
      ? "ytmusic"
      : isSpotifyPlaylistUrl(targetUrl)
      ? "spotify"
      : activePlatform;

    setIsPlaylistLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/playlist/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_or_id: targetUrl,
          limit: 100,
          platform: targetPlatform,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to fetch playlist");
      }
      const data = await res.json();
      setPlaylist(data);
      // Initialize scanned tracks with default explicit tag
      const platformName = targetPlatform === "spotify" ? "Spotify" : "YouTube Music";
      const initial = data.tracks.map((t) => ({
        ...t,
        source_platform: targetPlatform,
        verification_status: "unscanned",
        is_flagged: Boolean(t.is_explicit),
        reasons: t.is_explicit ? [`Marked Explicit by ${platformName}`] : [],
        detected_terms: [],
        snippets: [],
        has_lyrics: false,
      }));
      setScannedTracks(initial);
      if (setWorkingList) {
        setWorkingList(initial);
      }
      setStatusMessage({
        type: "success",
        text: `Loaded "${data.title}" with ${data.tracks.length} tracks.`,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsPlaylistLoading(false);
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
          track_id: track.id,
          platform: activePlatform,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to search for clean replacement");
      }
      const data = await res.json();
      if (data.found && data.clean_candidate) {
        const candId = data.clean_candidate.id;
        const resolvedLyrics =
          (candId && data.lyrics_by_id && data.lyrics_by_id[candId]) ||
          data.clean_candidate.lyrics ||
          undefined;
        const enrichedCandidate =
          resolvedLyrics !== undefined
            ? { ...data.clean_candidate, lyrics: resolvedLyrics }
            : data.clean_candidate;
        setCleanCandidates((prev) => ({
          ...prev,
          [track.id]: enrichedCandidate,
        }));
      } else {
        setCleanCandidates((prev) => ({ ...prev, [track.id]: "none" }));
      }
    } catch (err) {
      console.error(err);
      setActiveNotice({
        type: "caution",
        message: err.message || "Failed to search for clean replacement.",
      });
    } finally {
      setSearchingClean((prev) => ({ ...prev, [track.id]: false }));
    }
  };

  const handleBulkClean = async (
    customTracksToSwap = null,
    cumulativeStats = { swapped: 0, unfound: 0, initialTotal: null }
  ) => {
    const activeTracks = workingList && workingList.length > 0 ? workingList : scannedTracks;
    const flaggedToSwap =
      Array.isArray(customTracksToSwap) && customTracksToSwap.length > 0
        ? customTracksToSwap
        : activeTracks.filter(
            (t) => (t.is_flagged || t.verification_status === "flagged") && t.verification_status !== "clean_swapped"
          );

    if (!flaggedToSwap || flaggedToSwap.length === 0) return;

    const initialTotal = cumulativeStats.initialTotal ?? flaggedToSwap.length;
    setBulkCleaning(true);
    const initialAnnouncement = `Finding clean edits (${cumulativeStats.swapped + cumulativeStats.unfound} of ${initialTotal})…`;
    setBulkCleanProgress(initialAnnouncement);
    setScanProgressAnnouncement(initialAnnouncement);

    let currentBatchSwapped = 0;
    let currentBatchUnfound = 0;

    const outcome = await runBulkCleanPipeline({
      tracks: flaggedToSwap,
      platform: activePlatform,
      onProgress: ({ processed }) => {
        const overallProcessed = cumulativeStats.swapped + cumulativeStats.unfound + processed;
        const progressMsg = `Finding clean edits (${overallProcessed} of ${initialTotal})…`;
        setBulkCleanProgress(progressMsg);
        setScanProgressAnnouncement(progressMsg);
      },
      onBatchComplete: ({ results, lyricsById: batchLyrics, chunk = [] }) => {
        const newlySwapped = [];
        const newCandidatesUpdate = {};

        Object.entries(results).forEach(([origTrackId, cand]) => {
          if (cand) {
            const origTrack =
              chunk.find((t) => t.id === origTrackId) ||
              currentTracksRef.current.find((t) => t.id === origTrackId);
            if (origTrack) {
              const candLyrics =
                (cand.id && batchLyrics?.[cand.id]) ||
                cand.lyrics ||
                lyricsByTrackId?.[cand.id] ||
                undefined;
              const swapped = {
                ...origTrack,
                ...cand,
                verification_status: "clean_swapped",
                is_flagged: false,
                reasons: [],
                detected_terms: [],
                snippets: [],
                total_flagged_count: 0,
                is_explicit: false,
                has_lyrics: Boolean(typeof candLyrics === "string" && candLyrics.trim()),
                was_replaced: true,
                original_title: origTrack.original_title || origTrack.title,
                original_id: origTrack.original_id || origTrack.id,
                original_set_video_id: origTrack.original_set_video_id || origTrack.setVideoId,
              };
              newlySwapped.push({ origId: origTrackId, swappedTrack: swapped });
              currentBatchSwapped++;
            }
          } else {
            newCandidatesUpdate[origTrackId] = "none";
            currentBatchUnfound++;
          }
        });

        if (newlySwapped.length > 0) {
          const swapMap = new Map(newlySwapped.map((s) => [s.origId, s.swappedTrack]));
          const updater = (prev) => prev.map((t) => (swapMap.has(t.id) ? swapMap.get(t.id) : t));

          setScannedTracks(updater);
          if (setWorkingList) {
            setWorkingList(updater);
          }
          if (playlist && setPlaylist) {
            setPlaylist((prev) =>
              prev
                ? {
                    ...prev,
                    tracks: (prev.tracks || []).map((t) => (swapMap.has(t.id) ? swapMap.get(t.id) : t)),
                  }
                : prev
            );
          }
        }

        if (batchLyrics && Object.keys(batchLyrics).length > 0 && setLyricsByTrackId) {
          setLyricsByTrackId((prev) => ({
            ...prev,
            ...batchLyrics,
          }));
        }

        setCleanCandidates((prev) => {
          const updated = { ...prev };
          newlySwapped.forEach((s) => {
            delete updated[s.origId];
          });
          Object.assign(updated, newCandidatesUpdate);
          return updated;
        });
      },
    });

    setBulkCleaning(false);
    setBulkCleanProgress("");

    const totalSwapped = cumulativeStats.swapped + currentBatchSwapped;
    const totalUnfound = cumulativeStats.unfound + currentBatchUnfound;

    if (outcome.error) {
      const isRateLimit = outcome.error.status === 429 || outcome.error.isRateLimit;
      const errorMsg = isRateLimit
        ? "Rate limit reached while searching clean versions. You can retry remaining tracks."
        : outcome.error.message || "Failed to search clean versions. You can retry remaining tracks.";

      setScanProgressAnnouncement(errorMsg);
      setActiveNotice({
        type: isRateLimit ? "rate_limit" : "caution",
        message: errorMsg,
        actionLabel: "Retry",
        onAction: () => {
          setActiveNotice(null);
          handleBulkClean(outcome.unprocessedTracks, {
            swapped: totalSwapped,
            unfound: totalUnfound,
            initialTotal,
          });
        },
      });
      return;
    }

    // Fire-and-forget telemetry event emission
    try {
      fetch("/api/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "clean_swap_applied",
          properties: {
            mode: "bulk",
            swapped_count: totalSwapped,
            unfound_count: totalUnfound,
          },
        }),
      }).catch(() => {});
    } catch {
      // Fire-and-forget: ignore network failure or missing telemetry endpoint
    }

    const totalProcessed = totalSwapped + totalUnfound;
    let completionMsg = "";
    if (totalUnfound === 0 && totalSwapped > 0) {
      completionMsg = `Swapped all ${totalSwapped} flagged tracks to clean versions.`;
    } else {
      completionMsg = `Swapped ${totalSwapped} of ${totalProcessed} flagged tracks; ${
        totalUnfound === 1 ? "1 still needs review" : `${totalUnfound} still need review`
      }.`;
    }

    setScanProgressAnnouncement(completionMsg);
    setActiveNotice({
      type: totalSwapped > 0 ? "clean" : "caution",
      message: completionMsg,
    });
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
    const cleanLyrics =
      typeof cleanTrack?.lyrics === "string"
        ? cleanTrack.lyrics
        : cleanTrack?.id
        ? lyricsByTrackId?.[cleanTrack.id]
        : undefined;
    const swappedTrack = {
      ...originalTrack,
      ...cleanTrack,
      verification_status: "clean_swapped",
      is_flagged: false,
      reasons: [],
      detected_terms: [],
      snippets: [],
      total_flagged_count: 0,
      is_explicit: false,
      has_lyrics: Boolean(typeof cleanLyrics === "string" && cleanLyrics.trim()),
      was_replaced: true,
      original_title: originalTrack.title,
      original_id: originalTrack.id,
      original_set_video_id: originalTrack.setVideoId,
    };
    const swapFn = (t) => (t.id === originalTrack.id ? swappedTrack : t);

    setScannedTracks((prev) => prev.map(swapFn));
    if (setWorkingList) {
      setWorkingList((prev) => prev.map(swapFn));
    }
    if (playlist && setPlaylist) {
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              tracks: (prev.tracks || []).map(swapFn),
            }
          : prev
      );
    }
    if (setLyricsByTrackId && cleanTrack?.id) {
      const cleanLyrics =
        typeof cleanTrack.lyrics === "string"
          ? cleanTrack.lyrics
          : lyricsByTrackId?.[cleanTrack.id];
      if (typeof cleanLyrics === "string") {
        setLyricsByTrackId((prev) => ({
          ...prev,
          [cleanTrack.id]: cleanLyrics,
        }));
      }
    }
    setCleanCandidates((prev) => {
      const updated = { ...prev };
      delete updated[originalTrack.id];
      return updated;
    });
    const swapMsg = `Swapped "${originalTrack.title}" to clean version "${cleanTrack.title || originalTrack.title}".`;
    setScanProgressAnnouncement(swapMsg);
    setStatusMessage({
      type: "success",
      text: swapMsg,
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
    const blocklistChanged =
      lastScreeningConfigRef.current.customBlocklist !== customBlocklist &&
      JSON.stringify(lastScreeningConfigRef.current.customBlocklist) !== JSON.stringify(customBlocklist);
    if (
      lastScreeningConfigRef.current.preset !== preset ||
      blocklistChanged ||
      lastScreeningConfigRef.current.presetsData !== presetsData
    ) {
      lastScreeningConfigRef.current = { preset, customBlocklist, presetsData };
      reevaluateWith(preset, customBlocklist);
    }
  }, [preset, customBlocklist, presetsData, reevaluateWith]);

  const handleSelectPreset = (newPreset) => {
    lastScreeningConfigRef.current = { preset: newPreset, customBlocklist, presetsData };
    setPreset(newPreset);
    reevaluateWith(newPreset, customBlocklist);
  };

  const handleAddBlocklistTerm = (term) => {
    const currentList = Array.isArray(customBlocklist) ? customBlocklist : [];
    const next = [...currentList, term];
    lastScreeningConfigRef.current = { preset, customBlocklist: next, presetsData };
    setCustomBlocklist(next);
    reevaluateWith(preset, next);
  };

  const handleRemoveBlocklistTerm = (term) => {
    const currentList = Array.isArray(customBlocklist) ? customBlocklist : [];
    const next = currentList.filter((w) => w !== term);
    lastScreeningConfigRef.current = { preset, customBlocklist: next, presetsData };
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
    setSearchingClean({});
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

  const flaggedCount = currentTracks.filter(
    (t) => (t.is_flagged || t.verification_status === "flagged") && t.verification_status !== "clean_swapped"
  ).length;
  const cleanCount = currentTracks.length - flaggedCount;
  const initialTrackCount = playlist?.tracks?.length ?? scannedTracks.length;
  const removedCount = Math.max(0, initialTrackCount - scannedTracks.length);

  return (
    <div className="space-y-8">
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
        onLoadPlaylist={handleFetchPlaylist}
        onOpenLibraryPicker={() => setIsPickerModalOpen(true)}
        vipMode={isAuthenticated}
        isLoading={isPlaylistLoading}
      />

      {/* 1.1 Paste Track List Panel */}
      <PasteTrackListPanel
        isOpen={isPasteOpen}
        initialText={pasteInitialText}
        onClose={() => setIsPasteOpen(false)}
        onResolve={handleResolvePaste}
        isLoading={isResolvingPaste}
      />

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center space-x-2 ${
            statusMessage.type === "error"
              ? "bg-status-flagged-bg border-status-flagged-border text-status-flagged"
              : "bg-status-clean-bg border-status-clean-border text-status-clean"
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

      {/* 3-Step Empty State Hero (shown when working list is empty) */}
      {currentTracks.length === 0 && (
        <EmptyStateHero />
      )}

      {/* 2. Screening Controls Bar (shown when playlist loaded) */}
      {currentTracks.length > 0 && (
        <ScreeningControlsBar
          preset={preset}
          onSelectPreset={handleSelectPreset}
          customBlocklist={customBlocklist}
          onAddBlocklistTerm={handleAddBlocklistTerm}
          onRemoveBlocklistTerm={handleRemoveBlocklistTerm}
          onRunScan={handleRunScan}
          scanning={scanning}
          scanProgressAnnouncement={scanProgressAnnouncement}
          isMasked={isMasked}
          onToggleMasking={onToggleMasking}
          onBulkClean={() => handleBulkClean()}
          bulkCleaning={bulkCleaning}
          bulkCleanProgress={bulkCleanProgress}
          flaggedCount={flaggedCount}
        />
      )}

      {/* 3. Scanned Tracks Results */}
      {currentTracks.length > 0 && (
        <WorkingListWorkbench
          tracks={displayedTracks}
          totalTrackCount={scannedTracks.length}
          title={playlist?.title || "Working List"}
          subtitle={`${playlist?.author ? `By ${playlist.author} • ` : ""}${scannedTracks.length} tracks total`}
          onRemoveTrack={handleRemoveTrack}
          onClearList={handleClearList}
          onOpenLyrics={onOpenLyrics}
          cleanCandidates={cleanCandidates}
          searchingClean={searchingClean}
          onFindClean={handleFindClean}
          onSwapTrack={handleSwapTrack}
          keptTrackIds={keptTrackIds}
          onKeepTrack={onKeepTrack}
          isMasked={isMasked}
          headerActions={
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="hidden sm:flex items-center space-x-1.5 bg-status-flagged-bg/60 text-status-flagged text-xs px-3 py-1.5 rounded-xl border border-status-flagged-border/40">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold">{flaggedCount} Flagged</span>
              </div>
              <div className="hidden sm:flex items-center space-x-1.5 bg-status-clean-bg/60 text-status-clean text-xs px-3 py-1.5 rounded-xl border border-status-clean-border/40">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">{cleanCount} Clean</span>
              </div>
              <div className="hidden sm:flex items-center space-x-1.5 bg-surface-elevated text-text-secondary text-xs px-3 py-1.5 rounded-xl border border-border-subtle">
                <Trash2 className="w-4 h-4 text-text-muted" />
                <span className="font-semibold">{removedCount} Removed</span>
              </div>

              {activePlatform === "spotify" ? (
                isAuthenticated ? (
                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-medium rounded-xl flex items-center space-x-2 transition shadow"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to Spotify...</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="px-4 py-1.5 bg-surface-elevated hover:bg-surface-highest text-text-primary text-sm font-medium rounded-xl flex items-center space-x-2 border border-border-subtle transition"
                  >
                    <Sparkles className="w-4 h-4 text-brand-tint" />
                    <span>Login to Save</span>
                  </button>
                )
              ) : (
                <button
                  onClick={() => handleExportCSV()}
                  className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-medium rounded-xl flex items-center space-x-2 transition shadow"
                >
                  <FileText className="w-4 h-4" />
                  <span>Export to CSV</span>
                </button>
              )}
            </div>
          }
          toolbar={
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex space-x-1 bg-surface-inset p-1 rounded-xl border border-border-subtle w-full sm:w-auto">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    filterMode === "all"
                      ? "bg-brand-primary text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  All ({scannedTracks.length})
                </button>
                <button
                  onClick={() => setFilterMode("flagged")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    filterMode === "flagged"
                      ? "bg-status-flagged-border text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Flagged ({flaggedCount})
                </button>
                <button
                  onClick={() => setFilterMode("clean")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    filterMode === "clean"
                      ? "bg-status-clean-border text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Clean ({cleanCount})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
                <input
                  type="text"
                  aria-label="Search tracks"
                  placeholder="Search tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-inset border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-ring-focus"
                />
              </div>
            </div>
          }
        />
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
