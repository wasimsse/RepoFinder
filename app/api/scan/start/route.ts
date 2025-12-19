import { NextRequest, NextResponse } from 'next/server'
import { Scanner, ScanParams } from '@/lib/scanner'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check if there's already a running job
    const runningJob = await prisma.scanJob.findFirst({
      where: { status: 'running' },
    })

    if (runningJob) {
      return NextResponse.json(
        { error: 'A scan is already running', jobId: runningJob.id },
        { status: 409 }
      )
    }

    const body = await request.json()
    const params: ScanParams = {
      minScore: body.minScore ?? 2, // Lowered default - repos get 2 points for tool mention
      maxRepos: body.maxRepos ?? 80,
      repoPages: body.repoPages ?? 2,
      codePages: body.codePages ?? 1,
      language: body.language,
      pushedAfter: body.pushedAfter,
      starsMin: body.starsMin,
      customRepoQueries: body.customRepoQueries,
      customCodeQueries: body.customCodeQueries,
      fetchMetadata: body.fetchMetadata ?? false,
      cloneRepos: body.cloneRepos ?? false,
    }

    const scanner = new Scanner()
    const jobId = await scanner.startScan(params)

    return NextResponse.json({ jobId, params })
  } catch (error) {
    console.error('Error starting scan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start scan' },
      { status: 500 }
    )
  }
}

