"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Upload, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  ArrowLeft,
  LayoutGrid,
  List,
  Search,
  Plus,
  RefreshCw,
  Zap,
  Loader2,
  Trash2,
  ExternalLink,
  X
} from "lucide-react";
import Link from "next/link";
import { VideoPlayer } from "@repo/ui/video-player";

interface VideoData {
  id: string;
  title: string;
  status: 'PENDING' | 'TRANSCODING' | 'READY' | 'FAILED';
  rawPath: string;
  hlsPath?: string;
  thumbnail?: string;
  createdAt: string;
  duration: string;
  progress: number;
  jobId?: string;
  rate?: string;
}

export default function VideosPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "processing" | "ready">("all");
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mode, setMode] = useState<'transcode' | 'package'>('transcode');
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("streamify_videos");
    if (saved) {
      setVideos(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage whenever videos change
  useEffect(() => {
    localStorage.setItem("streamify_videos", JSON.stringify(videos));
  }, [videos]);

  // Handle Polling for Transcoding Videos
  useEffect(() => {
    const transcodingVideos = videos.filter(v => v.status === 'TRANSCODING' && v.jobId);
    
    if (transcodingVideos.length === 0) return;

    const interval = setInterval(async () => {
      const updatedVideos = [...videos];
      let hasChanges = false;

      for (let video of updatedVideos) {
        if (video.status === 'TRANSCODING' && video.jobId) {
          try {
            const res = await fetch(`/api/transcode/status?jobId=${video.jobId}`);
            if (!res.ok) continue;
            
            const data = await res.json();
            
            if (data.state === 'completed') {
              video.status = 'READY';
              video.progress = 100;
              video.hlsPath = data.result.hlsPath;
              hasChanges = true;
            } else if (data.state === 'failed') {
              video.status = 'FAILED';
              hasChanges = true;
            } else if (data.progress !== undefined) {
              if (video.progress !== data.progress) {
                video.progress = data.progress;
                hasChanges = true;
              }
            }
          } catch (err) {
            console.error("Polling error for video", video.id, err);
          }
        }
      }

      if (hasChanges) {
        setVideos(updatedVideos);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [videos]);

  const handleUploadClick = () => {
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
      const transcodeRes = await fetch('/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, rawPath: key, mode }),
      });

      if (!transcodeRes.ok) throw new Error('Transcoding trigger failed');
      const { jobId } = await transcodeRes.json();

      // 4. Add to local state
      const newVideo: VideoData = {
        id: videoId,
        title: file.name,
        status: 'TRANSCODING',
        rawPath: key,
        createdAt: new Date().toISOString(),
        duration: "0:00", // Would be nice to get this from metadata
        progress: 0,
        jobId,
        thumbnail: `https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800` // Mock thumnail
      };

      setVideos(prev => [newVideo, ...prev]);
      setIsUploading(false);
      setUploadProgress(0);

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      alert("Failed to upload video");
    }
  };

  const deleteVideo = (id: string) => {
     setVideos(prev => prev.filter(v => v.id !== id));
  };

  const filteredVideos = videos.filter(v => {
    if (activeTab === 'processing') return v.status === 'TRANSCODING' || v.status === 'PENDING';
    if (activeTab === 'ready') return v.status === 'READY';
    return true;
  }).filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30 font-sans overflow-x-hidden">
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                <Play size={18} fill="white" className="ml-0.5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Streamify</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10 hidden md:block" />
            <div className="hidden md:flex items-center gap-1 text-sm font-medium text-white/40">
              <Link href="/" className="hover:text-white px-3 py-1.5 rounded-lg transition-colors">Dashboard</Link>
              <span className="text-white/20 whitespace-pre"> / </span>
              <span className="text-white px-3 py-1.5 rounded-lg bg-white/5 font-semibold text-white">Videos</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mr-2">
              <button 
                onClick={() => setMode('transcode')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'transcode' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
              >
                Multi-Res
              </button>
              <button 
                onClick={() => setMode('package')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'package' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
              >
                Fast Package
              </button>
            </div>
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all group">
               <RefreshCw size={16} className="group-active:rotate-180 transition-transform duration-500" />
               Refresh
            </button>
            <button 
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] disabled:opacity-50"
            >
               {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
               {isUploading ? `Uploading ${uploadProgress}%` : 'Upload Video'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Video Management</h1>
          <p className="text-white/50 max-w-2xl">Manage your uploads, monitor real-time transcoding progress, and configure delivery settings all in one place.</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
           {[
             { label: "Total Videos", value: videos.length.toString(), icon: <Play className="text-blue-400" /> },
             { label: "Storage Used", value: "1.2 TB", icon: <Zap className="text-yellow-400" /> },
             { label: "Live Jobs", value: videos.filter(v => v.status === 'TRANSCODING').length.toString(), icon: <RefreshCw className="text-green-400 animate-spin-slow" /> },
             { label: "Success Rate", value: "98.2%", icon: <CheckCircle2 className="text-red-400" /> },
           ].map((stat, i) => (
             <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 hover:border-white/20 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                  {stat.icon}
                </div>
                <div>
                   <div className="text-xs font-bold text-white/40 uppercase tracking-wider">{stat.label}</div>
                   <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                </div>
             </div>
           ))}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
           <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
             {(['all', 'processing', 'ready'] as const).map((tab) => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                   activeTab === tab ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"
                 }`}
               >
                 {tab}
               </button>
             ))}
           </div>

           <div className="flex items-center gap-4">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input 
                  type="text" 
                  placeholder="Search videos..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 ring-red-500/50 transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
                 <button 
                   onClick={() => setView("grid")}
                   className={`p-2 rounded-lg transition-all ${view === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                 >
                   <LayoutGrid size={18} />
                 </button>
                 <button 
                   onClick={() => setView("list")}
                   className={`p-2 rounded-lg transition-all ${view === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                 >
                   <List size={18} />
                 </button>
              </div>
           </div>
        </div>

        {/* Video List */}
        {filteredVideos.length === 0 ? (
           <div className="p-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-white/20">
                 <Play size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">No videos found</h2>
              <p className="text-white/40 max-w-xs mb-8">Ready to get started? Upload your first video and experience the power of Streamify.</p>
              <button 
                onClick={handleUploadClick}
                className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Upload First Video
              </button>
           </div>
        ) : (
          view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video) => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  onDelete={() => deleteVideo(video.id)} 
                  onPlay={() => video.status === 'READY' && setSelectedVideo(video)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVideos.map((video) => (
                <VideoListRow 
                  key={video.id} 
                  video={video} 
                  onDelete={() => deleteVideo(video.id)} 
                  onPlay={() => video.status === 'READY' && setSelectedVideo(video)}
                />
              ))}
            </div>
          )
        )}
      </main>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedVideo(null)} />
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(220,38,38,0.2)] border border-white/10 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-6 right-6 z-[110] w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center transition-all"
            >
              <X size={20} />
            </button>
            <VideoPlayer 
              key={selectedVideo.id} 
              src={`http://localhost:9000/streamify/${selectedVideo.hlsPath}`} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, onDelete, onPlay }: { video: VideoData, onDelete: () => void, onPlay: () => void }) {
  const isTranscoding = video.status === "TRANSCODING";
  
  return (
    <div 
      onClick={onPlay}
      className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.08] transition-all hover:scale-[1.02] cursor-pointer shadow-2xl animate-in fade-in zoom-in-95 duration-500"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video">
        <img src={video.status === 'READY' ? video.thumbnail : 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800'} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md border border-white/10 ${
            video.status === 'READY' ? 'bg-green-500/20 text-green-400' :
            video.status === 'TRANSCODING' ? 'bg-blue-500/20 text-blue-400' :
            video.status === 'FAILED' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white'
          }`}>
            {video.status === 'READY' && <CheckCircle2 size={10} />}
            {video.status === 'TRANSCODING' && <RefreshCw size={10} className="animate-spin" />}
            {video.status === 'FAILED' && <AlertCircle size={10} />}
            {video.status}
          </div>
        </div>

        {/* Play Icon */}
        {video.status === 'READY' && (
          <div className="absolute inset-0 flex items-center justify-center translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-2xl">
              <Play size={20} fill="black" />
            </div>
          </div>
        )}

        {/* Transcoding Progress Stats */}
        {isTranscoding && (
          <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-[10px] font-bold text-white/70">
            {video.rate || '8.2 Mbps'}
          </div>
        )}
        
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-wider border border-white/10">
          {video.duration}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-sm line-clamp-1 group-hover:text-red-400 transition-colors">{video.title}</h3>
          <div className="relative group/menu">
            <button className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
              <MoreVertical size={16} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 hidden group-hover/menu:block">
               <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(); }}
                 className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
               >
                 <Trash2 size={14} /> Delete
               </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium mb-4">
           <Clock size={12} />
           {new Date(video.createdAt).toLocaleDateString()}
        </div>

        {/* Progress Bar */}
        {(isTranscoding || video.status === 'READY') && (
           <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold">
                 <span className="text-white/40 uppercase">Progress</span>
                 <span className={video.status === 'READY' ? 'text-green-500' : 'text-blue-400'}>{video.progress}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-1000 ${video.status === 'READY' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]'}`}
                   style={{ width: `${video.progress}%` }} 
                 />
              </div>
           </div>
        )}
        
        {video.status === 'FAILED' && (
          <div className="flex items-center gap-2 text-red-500/80 text-[10px] font-bold uppercase">
              <AlertCircle size={12} />
              Encoding Timeout
          </div>
        )}
      </div>
    </div>
  );
}

function VideoListRow({ video, onDelete, onPlay }: { video: VideoData, onDelete: () => void, onPlay: () => void }) {
  const isTranscoding = video.status === "TRANSCODING";

  return (
    <div 
      onClick={onPlay}
      className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-6 hover:bg-white/[0.08] transition-all cursor-pointer shadow-xl animate-in fade-in slide-in-from-right-4 duration-500"
    >
      <div className="h-16 w-16 min-w-[64px] rounded-xl overflow-hidden relative">
        <img src={video.status === 'READY' ? video.thumbnail : 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800'} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
           {video.status === 'READY' && <Play size={16} fill="white" />}
           {video.status === 'TRANSCODING' && <RefreshCw size={16} className="animate-spin" />}
           {video.status === 'FAILED' && <AlertCircle size={16} className="text-red-500" />}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
           <div className="min-w-0 flex-1">
             <h3 className="font-bold text-sm truncate group-hover:text-red-400 transition-colors uppercase tracking-tight">{video.title}</h3>
             <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-medium">
                   <Clock size={12} />
                   {new Date(video.createdAt).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{video.duration}</div>
             </div>
           </div>

           <div className="flex items-center gap-8">
              {/* Progress for list view */}
              {(isTranscoding || video.status === 'READY') && (
                <div className="hidden sm:flex flex-col items-end w-40">
                   <div className="flex items-center gap-2 mb-1.5 text-[10px] font-bold">
                      <span className="text-white/40 uppercase">Transcoding</span>
                      <span className={video.status === 'READY' ? 'text-green-500' : 'text-blue-400'}>{video.progress}%</span>
                   </div>
                   <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${video.status === 'READY' ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${video.progress}%` }} 
                      />
                   </div>
                </div>
              )}

              <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-white/10 hidden md:block ${
                video.status === 'READY' ? 'bg-green-500/20 text-green-400' :
                video.status === 'TRANSCODING' ? 'bg-blue-500/20 text-blue-400' :
                video.status === 'FAILED' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white'
              }`}>
                {video.status}
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                  <ExternalLink size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-2 text-white/30 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
