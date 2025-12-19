import { NextRequest, NextResponse } from 'next/server'
import { Scanner, ScanParams } from '@/lib/scanner'
import { prisma } from '@/lib/db'
import { GitHubAPI } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const testMode = body.testMode || false
    
    console.log('=== DEBUG SCAN TEST START ===')
    console.log('Test mode:', testMode)
    
    // First, test GitHub API directly
    const github = new GitHubAPI()
    const testQuery = body.testQuery || '"Cursor AI" in:readme'
    
    console.log('Testing GitHub API with query:', testQuery)
    
    try {
      const response = await github.searchRepositories(testQuery, 1, 10)
      console.log('GitHub API response:', {
        totalCount: response.total_count,
        itemsFound: response.items.length,
        rateLimit: github.getRateLimitInfo(),
      })
      
      if (testMode) {
        return NextResponse.json({
          success: true,
          message: 'GitHub API test successful',
          results: {
            totalCount: response.total_count,
            itemsFound: response.items.length,
            sampleRepos: response.items.slice(0, 3).map((repo: any) => ({
              name: repo.full_name,
              stars: repo.stargazers_count,
              url: repo.html_url,
            })),
          },
          rateLimit: github.getRateLimitInfo(),
          hasToken: !!process.env.GITHUB_TOKEN,
        })
      }
    } catch (apiError: any) {
      console.error('GitHub API error:', apiError.message)
      return NextResponse.json({
        success: false,
        error: 'GitHub API failed',
        details: apiError.message,
        rateLimit: github.getRateLimitInfo(),
      }, { status: 500 })
    }
    
    // Now test scanner with minimal params
    console.log('Starting scanner test...')
    const params: ScanParams = {
      minScore: body.minScore ?? 2, // Lower threshold for testing
      maxRepos: body.maxRepos ?? 10, // Small number for testing
      repoPages: body.repoPages ?? 1,
      codePages: body.codePages ?? 0, // Skip code search for faster test
      customRepoQueries: body.customRepoQueries || ['"Cursor AI" in:readme'],
      customCodeQueries: [],
    }
    
    console.log('Scan params:', JSON.stringify(params, null, 2))
    
    const scanner = new Scanner()
    const jobId = await scanner.startScan(params)
    
    // Wait a bit for scan to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check job status
    const job = await prisma.scanJob.findUnique({ where: { id: jobId } })
    
    return NextResponse.json({
      success: true,
      message: 'Scan started',
      jobId,
      jobStatus: job?.status,
      jobMessage: job?.message,
      jobProgress: job?.progress,
      params,
    })
  } catch (error: any) {
    console.error('Debug scan test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

