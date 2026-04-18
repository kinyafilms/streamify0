const { Worker } = require('bullmq');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const fs = require('fs');
const { transcodeToHLS } = require('./utils/transcode');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

// Load environment variables from root
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const worker = new Worker('video-transcoding', async (job) => {
  const { videoId, rawPath, mode = 'transcode' } = job.data;
  const tempInputDir = path.join(__dirname, '../tmp', videoId);
  const tempOutputDir = path.join(__dirname, '../tmp', videoId, 'hls');

  if (!fs.existsSync(tempInputDir)) fs.mkdirSync(tempInputDir, { recursive: true });

  const inputFileName = path.basename(rawPath);
  const localInputPath = path.join(tempInputDir, inputFileName);

  console.log(`[${videoId}] Starting ${mode} for ${rawPath}...`);

  try {
    // 1. Download file from S3
    const downloadParams = { Bucket: process.env.S3_BUCKET || 'streamify', Key: rawPath };
    const { Body } = await s3Client.send(new GetObjectCommand(downloadParams));
    
    const writeStream = fs.createWriteStream(localInputPath);
    await pipeline(Readable.from(Body), writeStream);

    // 2. Transcode / Package
    await transcodeToHLS(localInputPath, tempOutputDir, (progress) => {
      console.log(`[${videoId}] ${mode} progress: ${progress}%`);
      job.updateProgress(progress).catch(err => console.error('Progress update error:', err));
    }, { mode });

    // 3. Upload HLS segments (.ts and .m3u8) back to S3
    await uploadFolderToS3(tempOutputDir, `videos/${videoId}/hls/`);

    console.log(`[${videoId}] ${mode} complete and uploaded.`);
    
    // 4. Clean up (delete the entire video temp folder)
    fs.rmSync(tempInputDir, { recursive: true, force: true });
    
    const playlistName = mode === 'transcode' ? 'master.m3u8' : 'v0/index.m3u8';
    return { status: 'success', hlsPath: `videos/${videoId}/hls/${playlistName}` };
  } catch (error) {
    console.error(`[${videoId}] Job failed:`, error);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  }
});

async function uploadFolderToS3(folderPath, s3Prefix) {
  const files = getAllFiles(folderPath);

  for (const file of files) {
    const relativePath = path.relative(folderPath, file);
    const s3Key = path.join(s3Prefix, relativePath).replace(/\\/g, '/');
    const fileStream = fs.createReadStream(file);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET || 'streamify',
        Key: s3Key,
        Body: fileStream,
        ContentType: getContentType(file),
      },
    });

    await upload.done();
    console.log(`Uploaded ${s3Key}`);
  }
}

// Helper: Recursively get all files
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach((file) => {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

function getContentType(filePath) {
  if (filePath.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (filePath.endsWith('.ts')) return 'video/MP2T';
  return 'application/octet-stream';
}
