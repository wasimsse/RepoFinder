import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const minScore = searchParams.get('minScore')
    const starsMin = searchParams.get('starsMin')
    const pushedAfter = searchParams.get('pushedAfter')

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

    const results = await prisma.repoCandidate.findMany({
      where,
      orderBy: [{ score: 'desc' }, { stars: 'desc' }],
    })

    // Generate CSV
    const headers = ['Repository URL', 'Full Name', 'Score', 'Stars', 'Pushed At', 'Evidence Count', 'Evidence Summary']
    const rows = results.map((repo) => {
      const evidence = JSON.parse(repo.evidenceSummary || '[]')
      return [
        repo.repoUrl,
        repo.fullName,
        repo.score.toString(),
        repo.stars.toString(),
        repo.pushedAt.toISOString(),
        evidence.length.toString(),
        evidence.join('; '),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vibe-repos-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export results' },
      { status: 500 }
    )
  }
}

