import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const transcodingQueue = new Queue('video-transcoding', { connection });

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

  try {
    const job = await transcodingQueue.getJob(jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return NextResponse.json({
      jobId,
      state,
      progress,
      result: returnValue,
    });
  } catch (error) {
    console.error('Status Error:', error);
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}
