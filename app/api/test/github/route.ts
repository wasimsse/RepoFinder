import { NextResponse } from 'next/server'
import { GitHubAPI } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const github = new GitHubAPI()
    
    // Test 1: Simple repository search (doesn't require auth, but rate limited)
    console.log('Testing GitHub API...')
    
    try {
      const testQuery = 'language:javascript stars:>100'
      const response = await github.searchRepositories(testQuery, 1, 5)
      
      return NextResponse.json({
        success: true,
        message: 'GitHub API is working!',
        results: {
          totalCount: response.total_count,
          itemsFound: response.items.length,
          sampleRepos: response.items.map((repo: any) => ({
            name: repo.full_name,
            stars: repo.stargazers_count,
            url: repo.html_url,
          })),
        },
        rateLimit: github.getRateLimitInfo(),
        hasToken: !!process.env.GITHUB_TOKEN,
        note: process.env.GITHUB_TOKEN 
          ? '✅ Using authenticated API (5000 requests/hour)' 
          : '⚠️  Using unauthenticated API (60 requests/hour - very limited!)',
      })
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorDetails: error.toString(),
        hasToken: !!process.env.GITHUB_TOKEN,
        suggestion: !process.env.GITHUB_TOKEN 
          ? 'Add GITHUB_TOKEN to .env file for better rate limits'
          : 'Check if token is valid and has correct permissions',
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

