import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get the latest job
    const latestJob = await prisma.scanJob.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Get total count of repositories
    const totalCount = await prisma.repoCandidate.count()
    
    // Check if GitHub token is configured
    const hasToken = !!process.env.GITHUB_TOKEN

    if (!latestJob) {
      return NextResponse.json({
        status: 'idle',
        progress: 0,
        message: 'No scans run yet',
        totalCount,
        hasToken,
      })
    }

    return NextResponse.json({
      status: latestJob.status,
      progress: latestJob.progress,
      message: latestJob.message,
      startedAt: latestJob.startedAt,
      finishedAt: latestJob.finishedAt,
      rateLimitResetAt: latestJob.rateLimitResetAt,
      totalCount,
      jobId: latestJob.id,
      hasToken,
    })
  } catch (error) {
    console.error('Error getting scan status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    )
  }
}

