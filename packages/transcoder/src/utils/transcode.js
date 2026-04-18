const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

async function transcodeToHLS(inputPath, outputDir, onProgress, options = { mode: 'transcode' }) {

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mode = options.mode || 'transcode';

  if (mode === 'transcode') {
    ['v0', 'v1', 'v2'].forEach(v => {
      const dir = path.join(outputDir, v);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  } else {
    // For packaging only, we just use one output folder
    const dir = path.join(outputDir, 'v0');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const normalizedOutput = outputDir.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    if (mode === 'transcode') {
      const filterGraph = [
        '[0:v]split=3[v360][v720][v1080]',
        '[v360]scale=-2:360[v360out]',
        '[v720]scale=-2:720[v720out]',
        '[v1080]scale=-2:1080[v1080out]'
      ].join(';');

      command = command.outputOptions([
        '-filter_complex', filterGraph,
        '-map', '[v360out]', '-map', '0:a',
        '-map', '[v720out]', '-map', '0:a',
        '-map', '[v1080out]', '-map', '0:a',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-g', '48',
        '-sc_threshold', '0',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-b:v:0', '800k',
        '-b:v:1', '2800k',
        '-b:v:2', '5000k',
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-master_pl_name', 'master.m3u8',
        '-hls_segment_filename', `${normalizedOutput}/v%v/segment_%03d.ts`,
        '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2'
      ]).output(`${normalizedOutput}/v%v/index.m3u8`);
    } else {
      // Packaging Only (Fast Mode - Copying streams)
      command = command.outputOptions([
        '-c', 'copy', // Copy both video and audio
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', `${normalizedOutput}/v0/segment_%03d.ts`
      ]).output(`${normalizedOutput}/v0/index.m3u8`);
    }

    command
      .on('start', cmd => {
        console.log(`FFmpeg started (${mode} mode):\n`, cmd);
      })
      .on('progress', progress => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', () => {
        console.log(`Transcoding/Packaging (${mode}) finished`);
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

module.exports = { transcodeToHLS };