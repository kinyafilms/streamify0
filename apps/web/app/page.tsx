"use client";

import React, { useState, useRef } from 'react';
import { VideoPlayer } from '@repo/ui/video-player';
import { Zap, Shield, Globe, Play, Cloud, Code, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [videoSrc, setVideoSrc] = useState("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranscodeClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(10);

      // 1. Get presigned URL
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const { url, key, videoId } = await res.json();
      setUploadProgress(30);

      // 2. Upload to S3
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      setUploadProgress(70);

      // 3. Trigger transcoding
      setIsUploading(false);
      setIsTranscoding(true);
      
      const transcodeRes = await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, rawPath: key }),
      });

      if (!transcodeRes.ok) throw new Error('Transcoding trigger failed');
      const { jobId } = await transcodeRes.json();

      // 4. Poll for job completion
      const pollStatus = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/transcode/status?jobId=${jobId}`);
          const { state, result } = await statusRes.json();

          if (state === 'completed') {
            clearInterval(pollStatus);
            // Master playlist URL (MinIO endpoint for local dev)
            const hlsUrl = `http://localhost:9000/streamify/${result.hlsPath}`;
            setVideoSrc(hlsUrl);
            setIsTranscoding(false);
            setUploadProgress(100);
          } else if (state === 'failed') {
            clearInterval(pollStatus);
            setIsTranscoding(false);
            alert('Transcoding failed');
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setIsTranscoding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="video/*"
        onChange={handleFileChange}
      />

      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <Play size={18} fill="white" className="ml-0.5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Streamify</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <Link href="/videos" className="hover:text-white transition-colors">Manage Videos</Link>
            <a href="#" className="hover:text-white transition-colors">Solutions</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
            <a href="#" className="hover:text-white transition-colors">API Docs</a>
          </div>
          <button className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-neutral-200 transition-colors shadow-xl">
            Get Started
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-20 pb-40">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Open Source Bunny Alternative
            </div>
            <h1 className="text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
              Zero Buffering.<br />Minimal Cost.
            </h1>
            <p className="text-lg text-white/50 leading-relaxed max-w-lg">
              The ultimate open-source Video-on-Demand infrastructure. Adaptive streaming, global delivery, and a stunning YouTube-like player built for performance.
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleTranscodeClick}
                disabled={isUploading || isTranscoding}
                className="px-8 py-4 bg-red-600 rounded-2xl font-bold hover:bg-red-700 transition-all hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.3)] flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Uploading... {uploadProgress}%
                  </>
                ) : isTranscoding ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Transcoding...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Start Transcoding
                  </>
                )}
              </button>
              <button className="px-8 py-4 bg-white/5 rounded-2xl font-bold border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2">
                <Code size={18} />
                View GitHub
              </button>
            </div>
          </div>

          {/* Featured Player Preview */}
          <div className="relative">
            <div className="absolute -inset-4 bg-red-600/20 blur-3xl opacity-20" />
            <div className="relative group">
               <VideoPlayer key={videoSrc} src={videoSrc} />
               
               <div className="absolute -bottom-6 -right-6 bg-[#0a0a0a] border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce-slow">
                 <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Zap className="text-green-500" size={20} />
                 </div>
                 <div>
                   <div className="text-xs text-white/40 uppercase font-bold">Latency</div>
                   <div className="text-lg font-bold">0.42ms</div>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: <Cloud className="text-blue-400" />, 
              title: "Global Delivery", 
              desc: "Integrated with Cloudflare R2 for zero egress fees and worldwide caching." 
            },
            { 
              icon: <Zap className="text-yellow-400" />, 
              title: "Adaptive Bitrate", 
              desc: "FFmpeg-powered pipeline generating multi-resolution HLS for zero buffering." 
            },
            { 
              icon: <Shield className="text-red-400" />, 
              title: "Secure & Scalable", 
              desc: "Presigned URL ingestion and BullMQ task worker for maximum scalability." 
            }
          ].map((feature, i) => (
            <div key={feature.title} className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-default group">
              <div className="mb-6 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>
    </div>
  );
}
