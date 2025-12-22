import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { GitHubAPI } from '@/lib/github'

export const dynamic = 'force-dynamic'

/**
 * Backfill metadata for repositories that are missing it
 * This is useful for repos scanned before metadata collection was enabled
 */
export async function POST(request: NextRequest) {
  try {
    const github = new GitHubAPI()
    
    // Find repos missing metadata (null forks, openIssues, etc.)
    const reposMissingMetadata = await prisma.repoCandidate.findMany({
      where: {
        OR: [
          { forks: null },
          { openIssues: null },
          { contributors: null },
          { language: null },
        ],
      },
      take: 100, // Process in batches to avoid rate limits
      orderBy: { updatedAt: 'asc' }, // Process oldest first
    })

    if (reposMissingMetadata.length === 0) {
      return NextResponse.json({
        message: 'No repositories need metadata backfilling',
        processed: 0,
      })
    }

    let successCount = 0
    let errorCount = 0

    for (const repo of reposMissingMetadata) {
      try {
        const [owner, repoName] = repo.fullName.split('/')
        if (!owner || !repoName) continue

        // Fetch all metadata
        const [repoDetails, openIssues, totalIssues, openPRs, totalPRs, contributors] = await Promise.all([
          github.getRepoDetails(owner, repoName),
          github.getRepoIssues(owner, repoName, 'open'),
          github.getRepoIssues(owner, repoName, 'all'),
          github.getRepoPullRequests(owner, repoName, 'open'),
          github.getRepoPullRequests(owner, repoName, 'all'),
          github.getContributorsCount(owner, repoName),
        ])

        // Update the repository with fetched metadata
        await prisma.repoCandidate.update({
          where: { id: repo.id },
          data: {
            forks: repoDetails.forks_count,
            language: repoDetails.language || null,
            description: repoDetails.description || null,
            openIssues: openIssues,
            totalIssues: totalIssues,
            openPullRequests: openPRs,
            totalPullRequests: totalPRs,
            contributors: contributors,
            updatedAt: new Date(),
          },
        })

        successCount++

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 400))
      } catch (error: any) {
        console.error(`Error backfilling metadata for ${repo.fullName}:`, error?.message || error)
        // If rate limited, stop and return partial results
        if (error?.message?.includes('rate limit') || error?.status === 403) {
          console.log('Rate limit detected, stopping backfill')
          break
        }
        errorCount++
      }
    }

    const remaining = reposMissingMetadata.length - successCount - errorCount
    
    return NextResponse.json({
      message: `Backfilled metadata for ${successCount} repositories${remaining > 0 ? `. ${remaining} remaining. Run again to continue.` : '.'}`,
      processed: successCount,
      errors: errorCount,
      total: reposMissingMetadata.length,
      remaining: remaining,
    })
  } catch (error) {
    console.error('Error in backfill metadata:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to backfill metadata' },
      { status: 500 }
    )
  }
}

