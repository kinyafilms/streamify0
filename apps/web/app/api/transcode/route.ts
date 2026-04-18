import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { z } from 'zod';

const TranscodeSchema = z.object({
  videoId: z.string(),
  rawPath: z.string(),
});

// Reuse the same connection as the worker
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const transcodingQueue = new Queue('video-transcoding', { connection });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, rawPath } = TranscodeSchema.parse(body);

    const job = await transcodingQueue.add('transcode', {
      videoId,
      rawPath,
    });

    return NextResponse.json({
      status: 'queued',
      jobId: job.id,
      videoId,
    });
  } catch (error) {
    console.error('Transcode Error:', error);
    return NextResponse.json({ error: 'Failed to queue transcoding job' }, { status: 500 });
  }
}
