import { NextResponse } from 'next/server'
import { Scanner, ScanParams } from '@/lib/scanner'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('=== MINIMAL SCAN TEST ===')
    
    // Use absolute minimal settings to test with few API calls
    const params: ScanParams = {
      minScore: 2, // Low threshold
      maxRepos: 5, // Very small number
      repoPages: 1, // Only 1 page
      codePages: 0, // Skip code search entirely (saves API calls)
      customRepoQueries: ['"Cursor AI" in:readme'], // Single simple query
      customCodeQueries: [], // No code search
    }
    
    console.log('Starting minimal scan with params:', params)
    
    const scanner = new Scanner()
    const jobId = await scanner.startScan(params)
    
    // Wait a moment for scan to progress
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check results
    const job = await prisma.scanJob.findUnique({ where: { id: jobId } })
    const repoCount = await prisma.repoCandidate.count()
    const recentRepos = await prisma.repoCandidate.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json({
      success: true,
      message: 'Minimal scan test completed',
      job: {
        id: job?.id,
        status: job?.status,
        progress: job?.progress,
        message: job?.message,
      },
      results: {
        totalRepos: repoCount,
        recentRepos: recentRepos.map(r => ({
          name: r.fullName,
          url: r.repoUrl,
          score: r.score,
          stars: r.stars,
        })),
      },
      note: 'This used minimal API calls. Check if repos were saved!',
    })
  } catch (error: any) {
    console.error('Minimal scan test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

