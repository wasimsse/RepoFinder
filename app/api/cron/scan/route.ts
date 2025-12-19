import { NextRequest, NextResponse } from 'next/server'
import { Scanner, ScanParams } from '@/lib/scanner'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret) {
      const token = authHeader?.replace('Bearer ', '')
      if (token !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Check if there's already a running job
    const runningJob = await prisma.scanJob.findFirst({
      where: { status: 'running' },
    })

    if (runningJob) {
      return NextResponse.json({ message: 'Scan already running', jobId: runningJob.id })
    }

    // Use default params for cron
    const params: ScanParams = {
      minScore: 4,
      maxRepos: 80,
      repoPages: 2,
      codePages: 1,
    }

    const scanner = new Scanner()
    const jobId = await scanner.startScan(params)

    return NextResponse.json({ message: 'Scan started', jobId })
  } catch (error) {
    console.error('Error in cron scan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start scan' },
      { status: 500 }
    )
  }
}

