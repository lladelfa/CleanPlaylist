import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

    const { container } = render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(screen.getByText("Late Night Jazz")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /spotify playlist picker/i })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Showing 1–2 of 25")).toBeInTheDocument();
    expect(screen.getByText(/by userone • 25 tracks/i)).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute("src", "http://example.com/1.jpg");
    expect(screen.getByRole("dialog")).toHaveClass("bg-surface-card", "border-border-subtle");
    expect(screen.getByRole("dialog").className).not.toMatch(/green|emerald/i);
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

    await user.clear(searchInput);
    await user.type(searchInput, "no match");
    expect(screen.getByText("No playlists on this page match your filter.")).toBeInTheDocument();
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
    const searchInput = screen.getByPlaceholderText(/filter loaded playlists/i);

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.type(searchInput, "morning");
    expect(screen.queryByText("Late Night Jazz")).not.toBeInTheDocument();

    // Go to next page (offset=20)
    await user.click(nextButton);

    expect(await screen.findByText("Weekend Roadtrip")).toBeInTheDocument();
    expect(searchInput).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith("/api/spotify/playlists?limit=20&offset=20");
    expect(screen.getByText("Showing 21–21 of 25")).toBeInTheDocument();
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    // Go back to previous page (offset=0)
    await user.click(prevButton);

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/spotify/playlists?limit=20&offset=0");
  });

  it("disables pagination while the next page is loading", async () => {
    const user = userEvent.setup();
    let resolveNextPage;
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      if (url.includes("offset=20")) {
        return new Promise((resolve) => {
          resolveNextPage = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockPage1,
      });
    });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    await screen.findByText("Morning Workout");
    const prevButton = screen.getByRole("button", { name: /prev/i });
    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
    resolveNextPage({ ok: true, json: async () => mockPage2 });
    expect(await screen.findByText("Weekend Roadtrip")).toBeInTheDocument();
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

  it("shows a retryable alert for authorization failures", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockPage1 });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/reconnect your spotify account/i);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders a graceful empty-library state", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, has_next: false, has_prev: false }),
    });

    render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("No Spotify playlists found in your library.")).toBeInTheDocument();
    expect(screen.getByText("0 playlists")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it.each(["Escape", "backdrop", "close button"])("dismisses and resets paging/filter state using %s", async (dismissal) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.spyOn(global, "fetch").mockImplementation(async (url) => ({
      ok: true,
      json: async () => (url.includes("offset=20") ? mockPage2 : mockPage1),
    }));

    const { rerender } = render(
      <PlaylistPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectPlaylist={vi.fn()}
      />
    );

    await screen.findByText("Morning Workout");
    await user.type(screen.getByPlaceholderText(/filter loaded playlists/i), "morning");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Weekend Roadtrip");

    if (dismissal === "Escape") {
      fireEvent.keyDown(window, { key: "Escape" });
    } else if (dismissal === "backdrop") {
      fireEvent.click(screen.getByRole("dialog").parentElement);
    } else {
      await user.click(screen.getByRole("button", { name: /close playlist picker/i }));
    }

    expect(onClose).toHaveBeenCalled();
    rerender(
      <PlaylistPickerModal
        isOpen={false}
        onClose={onClose}
        onSelectPlaylist={vi.fn()}
      />
    );
    rerender(
      <PlaylistPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectPlaylist={vi.fn()}
      />
    );

    expect(await screen.findByText("Morning Workout")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/filter loaded playlists/i)).toHaveValue("");
    expect(screen.getByText("Showing 1–2 of 25")).toBeInTheDocument();
  });
});

// Story 7.10: focus management (focus-in, trap, Escape, focus return)
describe('PlaylistPickerModal focus management', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => mockPage1 });
  });

  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>Browse Library</button>
        <PlaylistPickerModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onSelectPlaylist={() => {}}
        />
      </div>
    );
  }

  async function openModal() {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Browse Library' });
    await user.click(opener);
    return { user, opener };
  }

  it('exposes dialog semantics and an accessible name', async () => {
    await openModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
  });

  it('moves focus into the dialog on open', async () => {
    await openModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement.tagName).toBe('INPUT');
  });

  it('locks body scroll while open and restores it on close', async () => {
    const { user } = await openModal();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('wraps Tab from the last focusable to the first and Shift+Tab back', async () => {
    const { user } = await openModal();
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll('button:not([disabled]), input:not([disabled])')
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const { user, opener } = await openModal();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('does not throw when the opener is unmounted before close', async () => {
    const { user, opener } = await openModal();
    opener.remove();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
