import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PlaylistPickerModal from "../PlaylistPickerModal";

const mockPage1 = {
  items: [
    {
      id: "pl_1",
      name: "Morning Workout",
      tracks_total: 25,
      thumbnail: "http://example.com/1.jpg",
      owner: "UserOne",
      url: "https://open.spotify.com/playlist/pl_1",
    },
    {
      id: "pl_2",
      name: "Late Night Jazz",
      tracks_total: 40,
      thumbnail: null,
      owner: "UserOne",
      url: "https://open.spotify.com/playlist/pl_2",
    },
  ],
  total: 25,
  limit: 20,
  offset: 0,
  has_next: true,
  has_prev: false,
};

const mockPage2 = {
  items: [
    {
      id: "pl_21",
      name: "Weekend Roadtrip",
      tracks_total: 18,
      thumbnail: "http://example.com/21.jpg",
      owner: "UserOne",
      url: "https://open.spotify.com/playlist/pl_21",
    },
  ],
  total: 25,
  limit: 20,
  offset: 20,
  has_next: false,
  has_prev: true,
};

describe("PlaylistPickerModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <PlaylistPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );
    expect(screen.queryByText(/spotify playlist picker|browse your library/i)).not.toBeInTheDocument();
  });

  it("fetches and renders playlists when opened", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockPage1,
    });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(screen.getByText("Late Night Jazz")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/spotify/playlists?limit=20&offset=0");
  });

  it("filters currently loaded playlists by name using the search input", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockPage1,
    });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(screen.getByText("Late Night Jazz")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search|filter/i);
    await user.type(searchInput, "jazz");

    expect(screen.queryByText("Morning Workout")).not.toBeInTheDocument();
    expect(screen.getByText("Late Night Jazz")).toBeInTheDocument();
  });

  it("cycles through pages of 20 playlists using Next and Prev buttons", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url.includes("offset=20")) {
        return { ok: true, json: async () => mockPage2 };
      }
      return { ok: true, json: async () => mockPage1 };
    });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();

    const prevButton = screen.getByRole("button", { name: /prev/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Go to next page (offset=20)
    await user.click(nextButton);

    expect(await screen.findByText("Weekend Roadtrip")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/spotify/playlists?limit=20&offset=20");
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    // Go back to previous page (offset=0)
    await user.click(prevButton);

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/spotify/playlists?limit=20&offset=0");
  });

  it("calls onSelectPlaylist and onClose when a playlist is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockPage1,
    });

    const onClose = vi.fn();
    const onSelectPlaylist = vi.fn();

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectPlaylist={onSelectPlaylist}
      />
    );

    const playlistItem = await screen.findByText("Morning Workout");
    await user.click(playlistItem);

    expect(onSelectPlaylist).toHaveBeenCalledWith("https://open.spotify.com/playlist/pl_1");
    expect(onClose).toHaveBeenCalled();
  });
});
