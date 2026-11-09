import { describe, it, expect } from 'vitest';
import {
  isMultiLine,
  parseTrackListLines,
  isSpotifyUrl,
  isSpotifyPlaylistUrl,
  isYouTubeUrl,
  isYouTubePlaylistUrl,
  isYouTubePlaylistId,
  isYouTubePlaylist,
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

  it('identifies Spotify playlist URLs and URIs via isSpotifyPlaylistUrl', () => {
    // Standard playlist URL
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);
    expect(isSpotifyPlaylistUrl('http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123xyz')).toBe(true);
    expect(isSpotifyPlaylistUrl('open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);

    // Localized intl routes
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/intl-es/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/intl-pt-BR/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test')).toBe(true);
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);

    // Legacy user playlist route
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/user/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);

    // Spotify playlist URI
    expect(isSpotifyPlaylistUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toBe(true);
    expect(isSpotifyPlaylistUrl('  spotify:playlist:37i9dQZF1DXcBWIGoYBM5M  ')).toBe(true);

    // Non-playlist Spotify URLs and URIs
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(false);
    expect(isSpotifyPlaylistUrl('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT')).toBe(false);
    expect(isSpotifyPlaylistUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT')).toBe(false);
    expect(isSpotifyPlaylistUrl('spotify:album:4cOdK2wGLETKBW3PvgPWqT')).toBe(false);

    // Non-Spotify URLs and non-string inputs
    expect(isSpotifyPlaylistUrl('https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(false);
    expect(isSpotifyPlaylistUrl('Daft Punk - Discovery')).toBe(false);
    expect(isSpotifyPlaylistUrl('')).toBe(false);
    expect(isSpotifyPlaylistUrl(null)).toBe(false);
    expect(isSpotifyPlaylistUrl(undefined)).toBe(false);
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

  it('identifies YouTube Music and YouTube playlist URLs via isYouTubePlaylistUrl', () => {
    expect(isYouTubePlaylistUrl('https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(true);
    expect(isYouTubePlaylistUrl('https://www.youtube.com/playlist?list=PLGW0Is3f0CKuxqGlK13w5h4r-62mHJR1Y')).toBe(true);
    expect(isYouTubePlaylistUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLGW0Is3f0CKuxqGlK13w5h4r-62mHJR1Y')).toBe(true);
    expect(isYouTubePlaylistUrl('https://music.youtube.com/watch?v=123')).toBe(false);
    expect(isYouTubePlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(false);
    expect(isYouTubePlaylistUrl('PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(false);
    expect(isYouTubePlaylistUrl('')).toBe(false);
    expect(isYouTubePlaylistUrl(null)).toBe(false);
  });

  it('identifies raw YouTube playlist IDs via isYouTubePlaylistId', () => {
    expect(isYouTubePlaylistId('PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(true);
    expect(isYouTubePlaylistId('OLAK5uy_k1234567890abcdef')).toBe(true);
    expect(isYouTubePlaylistId('RDCLAK5uy_1234567890abcdef')).toBe(true);
    expect(isYouTubePlaylistId('VLPLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(true);
    expect(isYouTubePlaylistId('https://music.youtube.com/playlist?list=PL123')).toBe(false);
    expect(isYouTubePlaylistId('random search query')).toBe(false);
    expect(isYouTubePlaylistId('')).toBe(false);
    expect(isYouTubePlaylistId(null)).toBe(false);
  });

  it('identifies any YouTube playlist URL or ID via isYouTubePlaylist', () => {
    expect(isYouTubePlaylist('https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(true);
    expect(isYouTubePlaylist('PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk')).toBe(true);
    expect(isYouTubePlaylist('Kendrick Lamar')).toBe(false);
    expect(isYouTubePlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(false);
  });

  it('classifies playlist inputs correctly in classifyInput', () => {
    const ytmPl = classifyInput('https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk', 'ytmusic');
    expect(ytmPl.type).toBe('playlist');
    expect(ytmPl.isCrossPlatform).toBe(false);
    expect(ytmPl.targetPlatform).toBe('ytmusic');

    const spPlCross = classifyInput('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'ytmusic');
    expect(spPlCross.type).toBe('playlist');
    expect(spPlCross.isCrossPlatform).toBe(true);
    expect(spPlCross.targetPlatform).toBe('spotify');
  });
});
