import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { RepoCloneService } from '@/lib/clone'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { repoId, repoUrl, fullName } = body

    if (!repoUrl || !fullName) {
      return NextResponse.json(
        { error: 'repoUrl and fullName are required' },
        { status: 400 }
      )
    }

    const cloneService = new RepoCloneService()
    const result = await cloneService.cloneRepo(repoUrl, fullName)

    if (result.success && result.path) {
      // Update database with clone info
      if (repoId) {
        await prisma.repoCandidate.update({
          where: { id: repoId },
          data: {
            clonedAt: new Date(),
            clonePath: result.path,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Repository cloned successfully',
        path: result.path,
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Clone failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error cloning repository:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clone repository' },
      { status: 500 }
    )
  }
}

