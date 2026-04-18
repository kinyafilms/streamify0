"use client";

import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Play, Pause, Volume2, Maximize, Settings, Subtitles, SkipForward, SkipBack } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onReady?: (player: any) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster, onReady }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initialize video.js player
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, {
        autoplay: false,
        controls: false, // We'll use our custom UI
        responsive: true,
        fluid: true,
        sources: [{ src, type: 'application/x-mpegURL' }],
        poster: poster,
        playbackRates: [0.5, 1, 1.5, 2]
      }, () => {
        onReady && onReady(player);
      });

      // Update state based on player events
      player.on('play', () => setIsPlaying(true));
      player.on('pause', () => setIsPlaying(false));
      player.on('timeupdate', () => {
        const currentTime = player.currentTime() || 0;
        const duration = player.duration() || 0;
        const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
        setProgress(percentage);
      });
    }
  }, [src, poster, onReady]);

  // Clean up on unmount
  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  const togglePlay = () => {
    if (playerRef.current) {
      if (playerRef.current.paused()) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (playerRef.current) {
      const duration = playerRef.current.duration() || 0;
      const time = (parseFloat(e.target.value) / 100) * duration;
      playerRef.current.currentTime(time);
      setProgress(parseFloat(e.target.value));
    }
  };

  return (
    <div className="relative group w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
      <div ref={videoRef} className="w-full h-full" />
      
      {/* Overlay Custom Controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300 opacity-0 group-hover:opacity-100 backdrop-blur-[2px]">
        {/* Progress Bar */}
        <input 
          type="range" 
          className="w-full h-1.5 mb-4 accent-red-600 bg-white/20 rounded-lg cursor-pointer appearance-none hover:h-2 transition-all"
          min="0" max="100" step="0.1"
          value={progress}
          onChange={handleSeek}
        />

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-6">
            <button onClick={togglePlay} className="hover:scale-110 transition-transform">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <div className="flex items-center gap-2 group/volume">
              <Volume2 size={22} className="text-white/80" />
              <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-300">
                <input type="range" className="w-20 h-1 accent-white" />
              </div>
            </div>
            <span className="text-sm font-medium text-white/90">
              0:00 / 0:00
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Settings size={22} className="cursor-pointer hover:rotate-45 transition-transform text-white/80" />
            <Maximize size={22} className="cursor-pointer hover:scale-110 transition-transform text-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
};
