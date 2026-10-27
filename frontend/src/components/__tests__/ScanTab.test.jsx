import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ScanTab from "../ScanTab";

const mockPlaylist = {
  id: "pl_123",
  title: "Road Trip Mix",
  author: "TestUser",
  tracks: [
    {
      id: "track_1",
      title: "Clean Song One",
      artist: "Artist A",
      duration: "3:15",
      is_explicit: false,
      is_flagged: false,
      reasons: [],
      video_url: "https://music.youtube.com/watch?v=1",
    },
    {
      id: "track_2",
      title: "Explicit Song Two",
      artist: "Artist B",
      duration: "2:45",
      is_explicit: true,
      is_flagged: true,
      reasons: ["Marked Explicit by YouTube Music"],
      video_url: "https://music.youtube.com/watch?v=2",
    },
    {
      id: "track_3",
      title: "Clean Song Three",
      artist: "Artist C",
      duration: "4:02",
      is_explicit: false,
      is_flagged: false,
      reasons: [],
      video_url: "https://music.youtube.com/watch?v=3",
    },
  ],
};

function StatefulScanTabWrapper({ initialPlaylist = mockPlaylist, initialTracks = mockPlaylist.tracks }) {
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [scannedTracks, setScannedTracks] = useState(initialTracks);
  const [customBlocklist, setCustomBlocklist] = useState([]);
  const [preset, setPreset] = useState("moderate");

  return (
    <ScanTab
      playlist={playlist}
      setPlaylist={setPlaylist}
      scannedTracks={scannedTracks}
      setScannedTracks={setScannedTracks}
      onOpenLyrics={vi.fn()}
      customBlocklist={customBlocklist}
      setCustomBlocklist={setCustomBlocklist}
      preset={preset}
      setPreset={setPreset}
      isAuthenticated={true}
      onOpenAuth={vi.fn()}
      activePlatform="spotify"
    />
  );
}

describe("ScanTab - Remove Tracks UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a Remove button with a trash icon on each track list item", () => {
    render(<StatefulScanTabWrapper />);

    const removeButtons = screen.getAllByRole("button", { name: /remove track/i });
    expect(removeButtons).toHaveLength(3);
  });

  it("removes a track from the UI list when its Remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<StatefulScanTabWrapper />);

    expect(screen.getByText("Explicit Song Two")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: /remove track/i });
    // Remove the second track ("Explicit Song Two")
    await user.click(removeButtons[1]);

    expect(screen.queryByText("Explicit Song Two")).not.toBeInTheDocument();
    expect(screen.getByText("Clean Song One")).toBeInTheDocument();
    expect(screen.getByText("Clean Song Three")).toBeInTheDocument();
  });

  it("automatically updates summary statistics (Total Tracks, Removed, Flagged, Clean) when tracks are removed", async () => {
    const user = userEvent.setup();
    render(<StatefulScanTabWrapper />);

    // Initial statistics: 3 total, 0 Removed, 1 Flagged, 2 Clean
    expect(screen.getByText(/3 tracks total/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Removed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Clean/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All \(3\)/i })).toBeInTheDocument();

    // Remove the flagged track ("Explicit Song Two")
    const removeButtons = screen.getAllByRole("button", { name: /remove track/i });
    await user.click(removeButtons[1]);

    // Updated statistics after removing 1 flagged track: 2 total, 1 Removed, 0 Flagged, 2 Clean
    expect(screen.getByText(/2 tracks total/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Removed/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Clean/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All \(2\)/i })).toBeInTheDocument();

    // Remove a clean track ("Clean Song One")
    const remainingRemoveButtons = screen.getAllByRole("button", { name: /remove track/i });
    await user.click(remainingRemoveButtons[0]);

    // Updated statistics after removing 1 clean track: 1 total, 2 Removed, 0 Flagged, 1 Clean
    expect(screen.getByText(/1 tracks total/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Removed/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Clean/i)).toBeInTheDocument();
  });

  it("excludes removed tracks from the final save request payload", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success" }),
    });

    render(<StatefulScanTabWrapper />);

    // Remove "Explicit Song Two" (track_2)
    const removeButtons = screen.getAllByRole("button", { name: /remove track/i });
    await user.click(removeButtons[1]);

    // Open Save Playlist Modal and submit
    const saveToSpotifyBtn = screen.getByRole("button", { name: /save to spotify/i });
    await user.click(saveToSpotifyBtn);

    const confirmSaveBtn = screen.getByRole("button", { name: /^save playlist$/i });
    await user.click(confirmSaveBtn);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/spotify/playlist/save");

    const body = JSON.parse(options.body);
    expect(body.final_track_ids).toEqual(["track_1", "track_3"]);
    expect(body.final_track_ids).not.toContain("track_2");
  });
});

