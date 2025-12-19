import { NextResponse } from 'next/server'
import { GitHubAPI } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const github = new GitHubAPI()
    
    // Test with a simple, specific query
    const testQuery = '"Cursor AI" in:readme'
    console.log(`Testing search with query: ${testQuery}`)
    
    try {
      const response = await github.searchRepositories(testQuery, 1, 5)
      
      return NextResponse.json({
        success: true,
        message: 'Simple scan test successful!',
        query: testQuery,
        results: {
          totalCount: response.total_count,
          itemsFound: response.items.length,
          repos: response.items.map((repo: any) => ({
            name: repo.full_name,
            stars: repo.stargazers_count,
            url: repo.html_url,
            description: repo.description?.substring(0, 100),
          })),
        },
        rateLimit: github.getRateLimitInfo(),
        hasToken: !!process.env.GITHUB_TOKEN,
        recommendation: !process.env.GITHUB_TOKEN 
          ? '⚠️  Add GITHUB_TOKEN to .env for 5000 requests/hour (currently limited to 60/hour)'
          : '✅ Token configured - you have good rate limits',
      })
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorDetails: error.toString(),
        rateLimit: github.getRateLimitInfo(),
        hasToken: !!process.env.GITHUB_TOKEN,
        suggestion: error.message.includes('403') || error.message.includes('rate limit')
          ? 'Rate limit exceeded. Add GITHUB_TOKEN to .env or wait for reset.'
          : 'Check query syntax or GitHub API status',
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

