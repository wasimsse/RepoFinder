/**
 * GitHub API wrapper with rate limiting and retry logic
 * All calls are server-side only
 */

const GITHUB_API_BASE = 'https://api.github.com'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // ms

export interface GitHubRepo {
  id: number
  full_name: string
  html_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
  description?: string
  language?: string
}

export interface GitHubRepoDetails extends GitHubRepo {
  issues_url?: string
  pulls_url?: string
  contributors_url?: string
  default_branch?: string
  clone_url?: string
  ssh_url?: string
}

export interface GitHubSearchResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubRepo[]
}

export interface GitHubCodeSearchItem {
  name: string
  path: string
  repository: {
    full_name: string
    html_url: string
  }
}

export interface GitHubCodeSearchResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubCodeSearchItem[]
}

export class GitHubAPI {
  private token: string | null
  private rateLimitRemaining: number = 5000
  private rateLimitReset: number = 0

  constructor() {
    this.token = process.env.GITHUB_TOKEN || null
    if (!this.token) {
      console.warn('GITHUB_TOKEN not set - rate limits will be strict (60 requests/hour)')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; headers: Headers }> {
    const url = `${GITHUB_API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        // Update rate limit tracking
        const remaining = response.headers.get('X-RateLimit-Remaining')
        const reset = response.headers.get('X-RateLimit-Reset')
        if (remaining) {
          this.rateLimitRemaining = parseInt(remaining, 10)
        }
        if (reset) {
          this.rateLimitReset = parseInt(reset, 10) * 1000 // Convert to ms
        }

        // Handle rate limiting
        if (response.status === 403) {
          const resetTime = response.headers.get('X-RateLimit-Reset')
          if (resetTime) {
            const resetTimestamp = parseInt(resetTime, 10) * 1000
            const waitTime = Math.max(0, resetTimestamp - Date.now())
            
            if (waitTime > 0) {
              throw new RateLimitError(
                `Rate limit exceeded. Reset at ${new Date(resetTimestamp).toISOString()}`,
                resetTimestamp
              )
            }
          }
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`GitHub API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        return { data: data as T, headers: response.headers }
      } catch (error) {
        lastError = error as Error
        
        // Don't retry rate limit errors
        if (error instanceof RateLimitError) {
          throw error
        }

        // Retry on transient errors
        if (attempt < MAX_RETRIES - 1 && this.isRetryableError(error as Error)) {
          await this.delay(RETRY_DELAY * (attempt + 1))
          continue
        }
        
        throw error
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  private isRetryableError(error: Error): boolean {
    // Retry on network errors or 5xx errors
    return error.message.includes('fetch') || error.message.includes('50')
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async searchRepositories(query: string, page: number = 1, perPage: number = 100): Promise<GitHubSearchResponse> {
    const encodedQuery = encodeURIComponent(query)
    const endpoint = `/search/repositories?q=${encodedQuery}&page=${page}&per_page=${perPage}&sort=updated&order=desc`
    const { data } = await this.request<GitHubSearchResponse>(endpoint)
    return data
  }

  async searchCode(query: string, page: number = 1, perPage: number = 100): Promise<GitHubCodeSearchResponse> {
    const encodedQuery = encodeURIComponent(query)
    const endpoint = `/search/code?q=${encodedQuery}&page=${page}&per_page=${perPage}`
    const { data } = await this.request<GitHubCodeSearchResponse>(endpoint)
    return data
  }

  async getRepoDetails(owner: string, repo: string): Promise<GitHubRepoDetails> {
    const endpoint = `/repos/${owner}/${repo}`
    const { data } = await this.request<GitHubRepoDetails>(endpoint)
    return data
  }

  async getRepoIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all', perPage: number = 1): Promise<number> {
    // Use per_page=1 to just get total count from headers
    const endpoint = `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&page=1`
    try {
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...(this.token ? { Authorization: `token ${this.token}` } : {}),
        },
      })
      
      // Get total from Link header if available, or count items
      const linkHeader = response.headers.get('Link')
      if (linkHeader) {
        // Parse Link header for total pages (last page number)
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
        if (lastMatch) {
          const lastPage = parseInt(lastMatch[1], 10)
          // Fetch last page to get accurate count
          const lastPageResponse = await fetch(`${GITHUB_API_BASE}${endpoint.replace('page=1', `page=${lastPage}`)}`, {
            headers: {
              Accept: 'application/vnd.github.v3+json',
              ...(this.token ? { Authorization: `token ${this.token}` } : {}),
            },
          })
          const lastPageData = await lastPageResponse.json()
          return (lastPage - 1) * perPage + lastPageData.length
        }
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data.length : 0
    } catch (error) {
      console.error(`Error getting issues for ${owner}/${repo}:`, error)
      return 0
    }
  }

  async getRepoPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all', perPage: number = 1): Promise<number> {
    const endpoint = `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&page=1`
    try {
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...(this.token ? { Authorization: `token ${this.token}` } : {}),
        },
      })
      
      const linkHeader = response.headers.get('Link')
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
        if (lastMatch) {
          const lastPage = parseInt(lastMatch[1], 10)
          const lastPageResponse = await fetch(`${GITHUB_API_BASE}${endpoint.replace('page=1', `page=${lastPage}`)}`, {
            headers: {
              Accept: 'application/vnd.github.v3+json',
              ...(this.token ? { Authorization: `token ${this.token}` } : {}),
            },
          })
          const lastPageData = await lastPageResponse.json()
          return (lastPage - 1) * perPage + lastPageData.length
        }
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data.length : 0
    } catch (error) {
      console.error(`Error getting PRs for ${owner}/${repo}:`, error)
      return 0
    }
  }

  async getContributorsCount(owner: string, repo: string): Promise<number> {
    const endpoint = `/repos/${owner}/${repo}/contributors?per_page=1&anon=false`
    try {
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...(this.token ? { Authorization: `token ${this.token}` } : {}),
        },
      })
      
      const linkHeader = response.headers.get('Link')
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
        if (lastMatch) {
          return parseInt(lastMatch[1], 10)
        }
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data.length : 0
    } catch (error) {
      console.error(`Error getting contributors for ${owner}/${repo}:`, error)
      return 0
    }
  }

  getRateLimitInfo() {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitReset ? new Date(this.rateLimitReset) : null,
    }
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public resetAt: number) {
    super(message)
    this.name = 'RateLimitError'
  }
}

