/**
 * Scanner service for detecting "vibe coding" repositories
 */

import { prisma } from './db'
import { GitHubAPI, RateLimitError, GitHubRepo, GitHubCodeSearchItem } from './github'

export interface ScanParams {
  minScore?: number
  maxRepos?: number
  repoPages?: number
  codePages?: number
  language?: string
  pushedAfter?: string
  starsMin?: number
  customRepoQueries?: string[]
  customCodeQueries?: string[]
  fetchMetadata?: boolean
  cloneRepos?: boolean
}

export interface CandidateRepo {
  repoUrl: string
  fullName: string
  score: number
  stars: number
  forks?: number
  openIssues?: number
  openPullRequests?: number
  totalIssues?: number
  totalPullRequests?: number
  contributors?: number
  language?: string
  description?: string
  pushedAt: Date
  evidenceSummary: string[]
}

// Scoring constants
const SCORE_TOOL_MENTION = 2
const SCORE_PROMPT_ARTIFACT = 3
const SCORE_CURSOR_FINGERPRINT = 3

export class Scanner {
  private github: GitHubAPI
  private jobId: string | null = null
  private cancelRequested = false

  constructor() {
    this.github = new GitHubAPI()
  }

  async startScan(params: ScanParams = {}): Promise<string> {
    // Create scan job
    const job = await prisma.scanJob.create({
      data: {
        status: 'running',
        startedAt: new Date(),
        progress: 0,
        params: JSON.stringify(params),
      },
    })

    this.jobId = job.id
    this.cancelRequested = false

    // Run scan asynchronously
    this.runScan(job.id, params).catch((error) => {
      console.error('Scan error:', error)
    })

    return job.id
  }

  async stopScan(jobId: string): Promise<void> {
    const job = await prisma.scanJob.findUnique({ where: { id: jobId } })
    if (job && job.status === 'running') {
      await prisma.scanJob.update({
        where: { id: jobId },
        data: { cancelRequested: true },
      })
      this.cancelRequested = true
    }
  }

  private async checkCanceled(jobId: string): Promise<boolean> {
    const job = await prisma.scanJob.findUnique({ where: { id: jobId } })
    return job?.cancelRequested ?? false
  }

  private async updateProgress(jobId: string, progress: number, message?: string): Promise<void> {
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { progress, message, updatedAt: new Date() },
    })
  }

  private async runScan(jobId: string, params: ScanParams): Promise<void> {
    const {
      minScore = 4,
      maxRepos = 80,
      repoPages = 2,
      codePages = 1,
      language,
      pushedAfter,
      starsMin,
    } = params

    try {
      // Step 1: Search repositories
      const repoQueries = params.customRepoQueries && params.customRepoQueries.length > 0
        ? this.applyFiltersToQueries(params.customRepoQueries, language, pushedAfter, starsMin)
        : this.buildRepoQueries(language, pushedAfter, starsMin)
      const allCandidates = new Map<string, CandidateRepo>()

      let totalRepos = 0
      for (const [index, query] of repoQueries.entries()) {
        if (await this.checkCanceled(jobId)) {
          await prisma.scanJob.update({
            where: { id: jobId },
            data: { status: 'canceled', finishedAt: new Date() },
          })
          return
        }

        await this.updateProgress(
          jobId,
          Math.floor((index / repoQueries.length) * 50),
          `Searching repositories (${index + 1}/${repoQueries.length})...`
        )

        for (let page = 1; page <= repoPages; page++) {
          try {
            const response = await this.github.searchRepositories(query, page, 100)
            
            for (const repo of response.items) {
              if (allCandidates.size >= maxRepos) break
              
              const repoUrl = repo.html_url
              const existingCandidate = allCandidates.get(repoUrl)
              
              if (!existingCandidate) {
                // New candidate - add base score for tool mention in README
                const evidence = `tool_mention: ${this.extractToolNameFromQuery(query)}`
                allCandidates.set(repoUrl, {
                  repoUrl,
                  fullName: repo.full_name,
                  score: SCORE_TOOL_MENTION,
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  language: repo.language || undefined,
                  description: repo.description || undefined,
                  pushedAt: new Date(repo.pushed_at),
                  evidenceSummary: [evidence],
                })
              } else {
                // Already exists - add evidence if not duplicate
                const evidence = `tool_mention: ${this.extractToolNameFromQuery(query)}`
                if (!existingCandidate.evidenceSummary.includes(evidence)) {
                  existingCandidate.evidenceSummary.push(evidence)
                  existingCandidate.score += SCORE_TOOL_MENTION
                }
              }
            }

            totalRepos += response.items.length
            if (response.items.length < 100) break // No more pages
          } catch (error) {
            if (error instanceof RateLimitError) {
              await prisma.scanJob.update({
                where: { id: jobId },
                data: {
                  status: 'rate_limited',
                  rateLimitResetAt: new Date(error.resetAt),
                  finishedAt: new Date(),
                },
              })
              return
            }
            console.error(`Error searching repos with query "${query}":`, error)
          }
        }

        // Small delay between queries
        await this.delay(500)
      }

      await this.updateProgress(jobId, 50, `Found ${allCandidates.size} candidate repositories`)

      // Step 2: Apply code search evidence (only if codePages > 0)
      let evidenceCount = 0
      if (codePages > 0) {
        const codeQueries = params.customCodeQueries && params.customCodeQueries.length > 0
          ? params.customCodeQueries
          : this.buildCodeQueries()

        for (const [index, query] of codeQueries.entries()) {
        if (await this.checkCanceled(jobId)) {
          await prisma.scanJob.update({
            where: { id: jobId },
            data: { status: 'canceled', finishedAt: new Date() },
          })
          return
        }

        await this.updateProgress(
          jobId,
          50 + Math.floor((index / codeQueries.length) * 40),
          `Searching code evidence (${index + 1}/${codeQueries.length})...`
        )

        for (let page = 1; page <= codePages; page++) {
          try {
            const response = await this.github.searchCode(query, page, 100)
            
            for (const item of response.items) {
              const repoUrl = `https://github.com/${item.repository.full_name}`
              const candidate = allCandidates.get(repoUrl)
              
              if (candidate) {
                const evidence = this.extractEvidenceFromCodeItem(item, query)
                if (evidence) {
                  candidate.evidenceSummary.push(evidence)
                  candidate.score += this.getEvidenceScore(evidence)
                  evidenceCount++
                }
              }
            }

            if (response.items.length < 100) break
          } catch (error) {
            if (error instanceof RateLimitError) {
              await prisma.scanJob.update({
                where: { id: jobId },
                data: {
                  status: 'rate_limited',
                  rateLimitResetAt: new Date(error.resetAt),
                  finishedAt: new Date(),
                },
              })
              return
            }
            console.error(`Error searching code with query "${query}":`, error)
          }
        }

        await this.delay(500)
        }
      }

      // Step 3: Fetch additional metadata if requested
      const fetchMetadata = params.fetchMetadata ?? false
      if (fetchMetadata) {
        await this.updateProgress(jobId, 85, 'Fetching repository metadata...')
        
        let metadataCount = 0
        for (const candidate of allCandidates.values()) {
          if (await this.checkCanceled(jobId)) return
          
          try {
            const [owner, repo] = candidate.fullName.split('/')
            if (!owner || !repo) continue
            
            // Fetch issues and PRs (use minimal API calls)
            // Note: forks, language, description already come from search results
            const [openIssues, totalIssues, openPRs, totalPRs, contributors] = await Promise.all([
              this.github.getRepoIssues(owner, repo, 'open'),
              this.github.getRepoIssues(owner, repo, 'all'),
              this.github.getRepoPullRequests(owner, repo, 'open'),
              this.github.getRepoPullRequests(owner, repo, 'all'),
              this.github.getContributorsCount(owner, repo),
            ])
            
            candidate.openIssues = openIssues
            candidate.totalIssues = totalIssues
            candidate.openPullRequests = openPRs
            candidate.totalPullRequests = totalPRs
            candidate.contributors = contributors
            
            metadataCount++
            if (metadataCount % 5 === 0) {
              await this.updateProgress(jobId, 85 + Math.floor((metadataCount / allCandidates.size) * 5), `Fetched metadata for ${metadataCount} repositories...`)
            }
            
            // Small delay to avoid rate limits
            await this.delay(200)
          } catch (error) {
            console.error(`Error fetching metadata for ${candidate.fullName}:`, error)
            // Continue with other repos
          }
        }
      }

      // Step 4: Filter by min score and save to database
      await this.updateProgress(jobId, 90, 'Saving results...')

      const validCandidates = Array.from(allCandidates.values()).filter((c) => c.score >= minScore)
      
      // Sort by score descending
      validCandidates.sort((a, b) => b.score - a.score)

      let saved = 0
      for (const candidate of validCandidates) {
        if (await this.checkCanceled(jobId)) {
          await prisma.scanJob.update({
            where: { id: jobId },
            data: { status: 'canceled', finishedAt: new Date() },
          })
          return
        }

        try {
          await prisma.repoCandidate.upsert({
            where: { repoUrl: candidate.repoUrl },
            update: {
              fullName: candidate.fullName,
              score: candidate.score,
              stars: candidate.stars,
              forks: candidate.forks ?? null,
              openIssues: candidate.openIssues ?? null,
              openPullRequests: candidate.openPullRequests ?? null,
              totalIssues: candidate.totalIssues ?? null,
              totalPullRequests: candidate.totalPullRequests ?? null,
              contributors: candidate.contributors ?? null,
              language: candidate.language ?? null,
              description: candidate.description ?? null,
              pushedAt: candidate.pushedAt,
              evidenceSummary: JSON.stringify(candidate.evidenceSummary),
              updatedAt: new Date(),
            },
            create: {
              repoUrl: candidate.repoUrl,
              fullName: candidate.fullName,
              score: candidate.score,
              stars: candidate.stars,
              forks: candidate.forks ?? null,
              openIssues: candidate.openIssues ?? null,
              openPullRequests: candidate.openPullRequests ?? null,
              totalIssues: candidate.totalIssues ?? null,
              totalPullRequests: candidate.totalPullRequests ?? null,
              contributors: candidate.contributors ?? null,
              language: candidate.language ?? null,
              description: candidate.description ?? null,
              pushedAt: candidate.pushedAt,
              evidenceSummary: JSON.stringify(candidate.evidenceSummary),
            },
          })
          saved++
        } catch (error) {
          console.error(`Error saving candidate ${candidate.repoUrl}:`, error)
        }
      }

      await prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress: 100,
          message: `Completed: ${saved} repositories saved`,
          finishedAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Scan failed:', error)
      await prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
        },
      })
    }
  }

  private buildRepoQueries(language?: string, pushedAfter?: string, starsMin?: number): string[] {
    const baseQueries = [
      '("vibe coding" OR vibecoding OR "prompt-driven" OR "AI-assisted" OR "built with Cursor" OR "Cursor AI") in:readme',
      '("GitHub Copilot" OR Copilot OR Windsurf OR "Claude Code" OR aider OR "Continue.dev") in:readme',
      '("LangGraph" OR AutoGen OR CrewAI) in:readme',
    ]

    return this.applyFiltersToQueries(baseQueries, language, pushedAfter, starsMin)
  }

  private applyFiltersToQueries(baseQueries: string[], language?: string, pushedAfter?: string, starsMin?: number): string[] {
    const queries: string[] = []
    for (const baseQuery of baseQueries) {
      let query = baseQuery
      if (language) {
        query += ` language:${language}`
      }
      if (pushedAfter) {
        query += ` pushed:>${pushedAfter}`
      }
      if (starsMin) {
        query += ` stars:>=${starsMin}`
      }
      queries.push(query)
    }

    return queries
  }

  private buildCodeQueries(): string[] {
    return [
      'filename:prompts.md OR filename:agent.md OR filename:SYSTEM_PROMPT.md',
      'path:.cursor OR "Cursor rules"',
    ]
  }

  private extractEvidenceFromCodeItem(item: GitHubCodeSearchItem, query: string): string | null {
    const fileName = item.name.toLowerCase()
    const path = item.path.toLowerCase()

    if (fileName.includes('prompt') || fileName.includes('agent') || fileName.includes('system_prompt')) {
      return `prompt_artifact: ${item.path}`
    }

    if (path.includes('.cursor') || query.includes('Cursor rules')) {
      return `cursor_fingerprint: ${item.path}`
    }

    return null
  }

  private getEvidenceScore(evidence: string): number {
    if (evidence.includes('prompt_artifact')) {
      return SCORE_PROMPT_ARTIFACT
    }
    if (evidence.includes('cursor_fingerprint')) {
      return SCORE_CURSOR_FINGERPRINT
    }
    return 0
  }

  private extractToolNameFromQuery(query: string): string {
    // Extract a readable tool name from the query
    if (query.includes('vibe coding') || query.includes('Cursor')) {
      return 'Cursor/vibe coding'
    }
    if (query.includes('Copilot')) {
      return 'GitHub Copilot'
    }
    if (query.includes('Windsurf')) {
      return 'Windsurf'
    }
    if (query.includes('LangGraph') || query.includes('AutoGen') || query.includes('CrewAI')) {
      return 'AI Framework'
    }
    return 'AI tool'
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

