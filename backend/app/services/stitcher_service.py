"""Playlist stitching, deduplication, and export service."""

import csv
import io
import re
from typing import Any, Dict, List, Optional, Set


class StitcherService:
    @staticmethod
    def normalize_title_artist(title: str, artist: str) -> str:
        """Create a simplified key for fuzzy deduplication."""
        # Strip featured artists, punctuation, and casing
        t = re.sub(r"\(.*?\)|\[.*?\]", "", title.lower())
        t = re.sub(r"[^\w\s]", "", t).strip()
        a = re.sub(r"[^\w\s]", "", artist.lower()).strip()
        return f"{t}___{a}"

    def stitch_playlists(
        self,
        playlists: List[Dict[str, Any]],
        order_mode: str = "sequential",  # "sequential" | "interleave" | "title_asc" | "artist_asc"
        deduplication_mode: str = "exact_id",  # "exact_id" | "title_artist" | "none"
        clean_mode: str = "keep_all",  # "keep_all" | "exclude_flagged" | "replace_clean_or_drop" | "replace_clean_or_keep"
        manual_replacements: Optional[Dict[str, Dict]] = None,
        manual_actions: Optional[Dict[str, str]] = None  # video_id -> "keep" | "replace" | "drop"
    ) -> Dict[str, Any]:
        """
        Merges tracks from multiple playlists, applies deduplication, clean filters,
        and custom ordering.
        """
        manual_replacements = manual_replacements or {}
        manual_actions = manual_actions or {}

        # 1. Gather all tracks with source playlist metadata
        raw_tracks: List[Dict] = []
        playlist_track_lists: List[List[Dict]] = []

        for p_idx, pl in enumerate(playlists):
            p_title = pl.get("title", f"Playlist {p_idx + 1}")
            p_tracks = pl.get("tracks", [])
            annotated = []
            for t in p_tracks:
                item = dict(t)
                item["source_playlist_title"] = p_title
                annotated.append(item)
            playlist_track_lists.append(annotated)

        # 2. Apply Ordering
        if order_mode == "sequential":
            for p_tracks in playlist_track_lists:
                raw_tracks.extend(p_tracks)
        elif order_mode == "interleave":
            max_len = max((len(lst) for lst in playlist_track_lists), default=0)
            for i in range(max_len):
                for lst in playlist_track_lists:
                    if i < len(lst):
                        raw_tracks.append(lst[i])
        elif order_mode == "title_asc":
            for p_tracks in playlist_track_lists:
                raw_tracks.extend(p_tracks)
            raw_tracks.sort(key=lambda x: x.get("title", "").lower())
        elif order_mode == "artist_asc":
            for p_tracks in playlist_track_lists:
                raw_tracks.extend(p_tracks)
            raw_tracks.sort(key=lambda x: x.get("artist", "").lower())
        else:
            for p_tracks in playlist_track_lists:
                raw_tracks.extend(p_tracks)

        total_input = len(raw_tracks)
        duplicates_removed = 0
        tracks_replaced = 0
        tracks_dropped = 0

        # 3. Deduplication
        deduped_tracks: List[Dict] = []
        seen_ids: Set[str] = set()
        seen_keys: Set[str] = set()

        for track in raw_tracks:
            v_id = track.get("id")
            norm_key = self.normalize_title_artist(track.get("title", ""), track.get("artist", ""))

            if deduplication_mode == "exact_id":
                if v_id in seen_ids:
                    duplicates_removed += 1
                    continue
                seen_ids.add(v_id)
            elif deduplication_mode == "title_artist":
                if norm_key in seen_keys:
                    duplicates_removed += 1
                    continue
                seen_keys.add(norm_key)

            deduped_tracks.append(track)

        # 4. Clean Filtering and Replacement
        final_tracks: List[Dict] = []

        for track in deduped_tracks:
            v_id = track.get("id")
            is_flagged = track.get("is_flagged", False) or track.get("is_explicit", False)
            clean_rep = manual_replacements.get(v_id) or track.get("clean_replacement")
            user_action = manual_actions.get(v_id)

            # Manual override takes priority
            if user_action == "drop":
                tracks_dropped += 1
                continue
            elif user_action == "replace" and clean_rep:
                rep_track = dict(clean_rep)
                rep_track["replaced_original"] = {
                    "id": track.get("id"),
                    "title": track.get("title"),
                    "artist": track.get("artist")
                }
                rep_track["source_playlist_title"] = track.get("source_playlist_title")
                final_tracks.append(rep_track)
                tracks_replaced += 1
                continue
            elif user_action == "keep":
                final_tracks.append(track)
                continue

            # Automatic rule-based filtering
            if is_flagged:
                if clean_mode == "exclude_flagged":
                    tracks_dropped += 1
                    continue
                elif clean_mode == "replace_clean_or_drop":
                    if clean_rep:
                        rep_track = dict(clean_rep)
                        rep_track["replaced_original"] = {
                            "id": track.get("id"),
                            "title": track.get("title"),
                            "artist": track.get("artist")
                        }
                        rep_track["source_playlist_title"] = track.get("source_playlist_title")
                        final_tracks.append(rep_track)
                        tracks_replaced += 1
                    else:
                        tracks_dropped += 1
                    continue
                elif clean_mode == "replace_clean_or_keep":
                    if clean_rep:
                        rep_track = dict(clean_rep)
                        rep_track["replaced_original"] = {
                            "id": track.get("id"),
                            "title": track.get("title"),
                            "artist": track.get("artist")
                        }
                        rep_track["source_playlist_title"] = track.get("source_playlist_title")
                        final_tracks.append(rep_track)
                        tracks_replaced += 1
                    else:
                        final_tracks.append(track)
                    continue

            # Standard clean track
            final_tracks.append(track)

        # Update 1-based sequential indices
        for idx, t in enumerate(final_tracks, start=1):
            t["stitched_index"] = idx

        return {
            "tracks": final_tracks,
            "stats": {
                "total_input_tracks": total_input,
                "duplicates_removed": duplicates_removed,
                "tracks_replaced": tracks_replaced,
                "tracks_dropped": tracks_dropped,
                "final_track_count": len(final_tracks),
            }
        }

    def export_as_m3u(self, tracks: List[Dict], playlist_title: str = "Clean Playlist") -> str:
        """Export tracks as an extended M3U8 playlist."""
        lines = ["#EXTM3U", f"#PLAYLIST:{playlist_title}"]
        for t in tracks:
            sec = t.get("duration_seconds", 0)
            title = t.get("title", "Unknown Title")
            artist = t.get("artist", "Unknown Artist")
            url = t.get("video_url", f"https://music.youtube.com/watch?v={t.get('id')}")
            lines.append(f"#EXTINF:{sec},{artist} - {title}")
            lines.append(url)
        return "\n".join(lines)

    def export_as_csv(self, tracks: List[Dict]) -> str:
        """Export tracks to CSV string."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Index", "Title", "Artist", "Duration", "Explicit", "YouTube Music Link", "Source Playlist"])
        for idx, t in enumerate(tracks, start=1):
            writer.writerow([
                idx,
                t.get("title", ""),
                t.get("artist", ""),
                t.get("duration", ""),
                "Yes" if t.get("is_explicit") else "No",
                t.get("video_url", ""),
                t.get("source_playlist_title", "")
            ])
        return output.getvalue()


stitcher_service = StitcherService()
