import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

const CAVEAT = 'Based on the lyrics we could find and your selected preset. You make the final call.';

function Wrapper({ tracks }) {
  const [playlist, setPlaylist] = useState({ id: 'pl', title: 'L', tracks });
  const [scannedTracks, setScannedTracks] = useState(tracks);
  const [workingList, setWorkingList] = useState(tracks);
  const [lyricsByTrackId, setLyricsByTrackId] = useState({});
  const [customBlocklist, setCustomBlocklist] = useState([]);
  const [preset, setPreset] = useState('moderate');
  return (
    <ScanTab
      playlist={playlist}
      setPlaylist={setPlaylist}
      scannedTracks={scannedTracks}
      setScannedTracks={(u) => { setScannedTracks(u); setWorkingList(u); }}
      workingList={workingList}
      setWorkingList={setWorkingList}
      lyricsByTrackId={lyricsByTrackId}
      setLyricsByTrackId={setLyricsByTrackId}
      customBlocklist={customBlocklist}
      setCustomBlocklist={setCustomBlocklist}
      preset={preset}
      setPreset={setPreset}
      presetsData={null}
      isAuthenticated
      onOpenAuth={vi.fn()}
      onOpenLyrics={vi.fn()}
      activePlatform="ytmusic"
    />
  );
}

const clean = [{ id: 't1', title: 'One', artist: 'A', artists_list: ['A'], verification_status: 'verified_clean' }];
const unscanned = [{ id: 't2', title: 'Two', artist: 'B', artists_list: ['B'], verification_status: 'unscanned' }];

describe('Story 7.9: one-time Verified Clean results note', () => {
  beforeEach(() => {
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });

  it('shows the caveat note when a track is Verified Clean, and dismissal persists for the session', () => {
    const { unmount } = render(<Wrapper tracks={clean} />);
    expect(screen.getByTestId('verified-clean-note')).toHaveTextContent(CAVEAT);
    fireEvent.click(screen.getByRole('button', { name: /dismiss verified clean note/i }));
    expect(screen.queryByTestId('verified-clean-note')).not.toBeInTheDocument();
    unmount();
    render(<Wrapper tracks={clean} />);
    expect(screen.queryByTestId('verified-clean-note')).not.toBeInTheDocument();
  });

  it('does not show the note when no track is Verified Clean', () => {
    render(<Wrapper tracks={unscanned} />);
    expect(screen.queryByTestId('verified-clean-note')).not.toBeInTheDocument();
  });
});
