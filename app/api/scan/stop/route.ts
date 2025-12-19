import { NextRequest, NextResponse } from 'next/server'
import { Scanner } from '@/lib/scanner'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jobId = body.jobId

    if (!jobId) {
      // Stop the currently running job
      const runningJob = await prisma.scanJob.findFirst({
        where: { status: 'running' },
      })

      if (!runningJob) {
        return NextResponse.json({ error: 'No running scan found' }, { status: 404 })
      }

      const scanner = new Scanner()
      await scanner.stopScan(runningJob.id)
      return NextResponse.json({ success: true, jobId: runningJob.id })
    } else {
      const scanner = new Scanner()
      await scanner.stopScan(jobId)
      return NextResponse.json({ success: true, jobId })
    }
  } catch (error) {
    console.error('Error stopping scan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop scan' },
      { status: 500 }
    )
  }
}

