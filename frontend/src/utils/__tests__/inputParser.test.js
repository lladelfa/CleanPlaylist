import { describe, it, expect } from 'vitest';
import {
  isMultiLine,
  parseTrackListLines,
  isSpotifyUrl,
  isYouTubeUrl,
  classifyInput,
} from '../inputParser';

describe('inputParser utility', () => {
  it('detects multi-line text correctly', () => {
    expect(isMultiLine('Song One\nSong Two')).toBe(true);
    expect(isMultiLine('Single line song')).toBe(false);
    expect(isMultiLine('')).toBe(false);
    expect(isMultiLine(null)).toBe(false);
  });

  it('strips empty lines and trims whitespace in parseTrackListLines', () => {
    const raw = `
      The Killers - Mr. Brightside  
      
      Coldplay - Yellow
      
         
      Queen - Bohemian Rhapsody
    `;
    const lines = parseTrackListLines(raw);
    expect(lines).toEqual([
      'The Killers - Mr. Brightside',
      'Coldplay - Yellow',
      'Queen - Bohemian Rhapsody',
    ]);
  });

  it('identifies Spotify URLs and URIs', () => {
    expect(isSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=123')).toBe(true);
    expect(isSpotifyUrl('http://open.spotify.com/album/123')).toBe(true);
    expect(isSpotifyUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT')).toBe(true);
    expect(isSpotifyUrl('https://music.youtube.com/watch?v=123')).toBe(false);
    expect(isSpotifyUrl('some random song title')).toBe(false);
  });

  it('identifies YouTube and YouTube Music URLs', () => {
    expect(isYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('https://open.spotify.com/track/123')).toBe(false);
  });

  it('classifies input with cross-platform detection', () => {
    // Spotify platform with YTM URL
    const res1 = classifyInput('https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'spotify');
    expect(res1.isCrossPlatform).toBe(true);
    expect(res1.targetPlatform).toBe('ytmusic');

    // YTM platform with Spotify URL
    const res2 = classifyInput('https://open.spotify.com/track/123', 'ytmusic');
    expect(res2.isCrossPlatform).toBe(true);
    expect(res2.targetPlatform).toBe('spotify');

    // Matching platforms
    const res3 = classifyInput('https://open.spotify.com/track/123', 'spotify');
    expect(res3.isCrossPlatform).toBe(false);
    expect(res3.targetPlatform).toBe('spotify');

    // Plain query
    const res4 = classifyInput('Daft Punk - One More Time', 'spotify');
    expect(res4.type).toBe('query');
    expect(res4.isCrossPlatform).toBe(false);

    // Whitespace only
    const res5 = classifyInput('   \t  ', 'spotify');
    expect(res5.type).toBe('empty');
  });
});
