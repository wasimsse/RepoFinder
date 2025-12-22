import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const minScore = searchParams.get('minScore')
    const language = searchParams.get('language')
    const pushedAfter = searchParams.get('pushedAfter')
    const starsMin = searchParams.get('starsMin')

    const where: any = {}

    if (minScore) {
      where.score = { gte: parseInt(minScore, 10) }
    }

    if (starsMin) {
      where.stars = { gte: parseInt(starsMin, 10) }
    }

    if (pushedAfter) {
      where.pushedAt = { gte: new Date(pushedAfter) }
    }

    if (language) {
      where.language = { contains: language, mode: 'insensitive' }
    }

    const skip = (page - 1) * limit

    const [results, total] = await Promise.all([
      prisma.repoCandidate.findMany({
        where,
        orderBy: [{ score: 'desc' }, { stars: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.repoCandidate.count({ where }),
    ])

    // Parse evidenceSummary JSON strings
    const resultsWithParsedEvidence = results.map((repo) => ({
      ...repo,
      evidenceSummary: JSON.parse(repo.evidenceSummary || '[]'),
      evidenceCount: JSON.parse(repo.evidenceSummary || '[]').length,
    }))

    return NextResponse.json({
      results: resultsWithParsedEvidence,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch results' },
      { status: 500 }
    )
  }
}

