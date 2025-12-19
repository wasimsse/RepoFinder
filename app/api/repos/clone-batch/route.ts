import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { RepoCloneService } from '@/lib/clone'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { repoIds } = body // Array of repo IDs to clone

    if (!Array.isArray(repoIds) || repoIds.length === 0) {
      return NextResponse.json(
        { error: 'repoIds array is required' },
        { status: 400 }
      )
    }

    // Fetch repos from database
    const repos = await prisma.repoCandidate.findMany({
      where: { id: { in: repoIds } },
      select: { id: true, repoUrl: true, fullName: true },
    })

    const cloneService = new RepoCloneService()
    const results = await cloneService.cloneMultiple(
      repos.map(r => ({ url: r.repoUrl, fullName: r.fullName })),
      (current, total) => {
        console.log(`Cloning progress: ${current}/${total}`)
      }
    )

    // Update database with clone info
    for (let i = 0; i < repos.length; i++) {
      if (results[i].success && results[i].path) {
        await prisma.repoCandidate.update({
          where: { id: repos[i].id },
          data: {
            clonedAt: new Date(),
            clonePath: results[i].path,
          },
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      message: `Cloned ${successCount}/${repos.length} repositories`,
      results: results.map((r, i) => ({
        repo: repos[i].fullName,
        success: r.success,
        path: r.path,
        error: r.error,
      })),
    })
  } catch (error) {
    console.error('Error batch cloning repositories:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clone repositories' },
      { status: 500 }
    )
  }
}

