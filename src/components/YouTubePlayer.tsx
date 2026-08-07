// YouTubePlayer.tsx - Official TOS-Compliant YouTube Video & Playlist Player Component

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Minimize2, Maximize2, X, Music, AlertCircle } from 'lucide-react';

interface YouTubePlayerProps {
  url: string;
  onClose: () => void;
  onRequireAudioCapture?: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  loadPlaylist: (options: { list: string; listType: string; index?: number }) => void;
  getVideoData: () => { title: string; author: string };
  destroy: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  url,
  onClose,
  onRequireAudioCapture,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoTitle, setVideoTitle] = useState<string>('YouTube Audio Stream');
  const [channelName, setChannelName] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isPlaylist, setIsPlaylist] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extract video ID and playlist ID from URL
  const extractParams = (rawUrl: string) => {
    let videoId: string | null = null;
    let playlistId: string | null = null;

    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v');
        playlistId = parsed.searchParams.get('list');
      } else if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
        playlistId = parsed.searchParams.get('list');
      }
    } catch {
      // Ignore URL parse error
    }

    return { videoId, playlistId };
  };

  useEffect(() => {
    const { videoId, playlistId } = extractParams(url);
    if (!videoId && !playlistId) {
      setErrorMsg('Invalid YouTube URL. Please paste a valid YouTube video or playlist link.');
      return;
    }

    setErrorMsg(null);
    setIsPlaylist(!!playlistId);

    // Load YouTube IFrame API script if not present
    const loadAPI = () => {
      if (window.YT && window.YT.Player) {
        initPlayer(videoId, playlistId);
      } else {
        const existingScript = document.getElementById('yt-iframe-api');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'yt-iframe-api';
          script.src = 'https://www.youtube.com/iframe_api';
          document.body.appendChild(script);
        }

        window.onYouTubeIframeAPIReady = () => {
          initPlayer(videoId, playlistId);
        };
      }
    };

    const initPlayer = (vId: string | null, pId: string | null) => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch { /* ignore */ }
      }

      const playerElement = document.getElementById('yt-player-frame');
      if (!playerElement || !window.YT) return;

      const playerVars: Record<string, unknown> = {
        autoplay: 1,
        controls: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      };

      if (pId) {
        playerVars.listType = 'playlist';
        playerVars.list = pId;
      }

      playerRef.current = new window.YT.Player('yt-player-frame', {
        height: '180',
        width: '320',
        videoId: vId || undefined,
        playerVars,
        events: {
          onReady: (event) => {
            event.target.playVideo();
            updateMetaData(event.target);
            if (onRequireAudioCapture) onRequireAudioCapture();
          },
          onStateChange: (event) => {
            if (window.YT) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                updateMetaData(event.target);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
            }
          },
          onError: () => {
            setErrorMsg('YouTube player error or playback restriction.');
          },
        },
      });
    };

    const updateMetaData = (player: YTPlayer) => {
      try {
        const data = player.getVideoData();
        if (data) {
          setVideoTitle(data.title || 'YouTube Audio');
          setChannelName(data.author || '');
        }
      } catch { /* ignore */ }
    };

    loadAPI();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch { /* ignore */ }
      }
    };
  }, [url]);

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleNext = () => {
    if (playerRef.current && isPlaylist) {
      playerRef.current.nextVideo();
    }
  };

  const handlePrev = () => {
    if (playerRef.current && isPlaylist) {
      playerRef.current.previousVideo();
    }
  };

  return (
    <div className={`yt-floating-card ${isMinimized ? 'minimized' : ''}`} ref={containerRef}>
      {/* Card Header */}
      <div className="yt-card-header">
        <div className="yt-title-info">
          <Music className="tiny-icon text-red-400" />
          <span className="yt-video-title">{videoTitle}</span>
          {channelName && <span className="yt-channel-name">• {channelName}</span>}
        </div>

        <div className="yt-header-actions">
          <button
            className="yt-icon-btn"
            onClick={() => setIsMinimized((prev) => !prev)}
            title={isMinimized ? 'Expand Video' : 'Minimize Video'}
          >
            {isMinimized ? <Maximize2 className="tiny-icon" /> : <Minimize2 className="tiny-icon" />}
          </button>

          <button className="yt-icon-btn" onClick={onClose} title="Close YouTube Player">
            <X className="tiny-icon" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="yt-error-banner">
          <AlertCircle className="tiny-icon" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Embedded IFrame Video Frame */}
      <div className={`yt-video-container ${isMinimized ? 'hidden' : ''}`}>
        <div id="yt-player-frame" />
      </div>

      {/* Player Controls Bar */}
      <div className="yt-controls-bar">
        {isPlaylist && (
          <button className="yt-control-btn" onClick={handlePrev} title="Previous Track">
            <SkipBack className="tiny-icon" />
          </button>
        )}

        <button className="yt-control-btn primary" onClick={handleTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause className="tiny-icon" /> : <Play className="tiny-icon" />}
        </button>

        {isPlaylist && (
          <button className="yt-control-btn" onClick={handleNext} title="Next Track">
            <SkipForward className="tiny-icon" />
          </button>
        )}

        <div className="yt-notice-pill">
          <span>Tip: Click <strong>Tab / System</strong> Audio for live real-time visualization!</span>
        </div>
      </div>
    </div>
  );
};
