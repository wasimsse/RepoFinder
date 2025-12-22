'use client'

import { useEffect, useState } from 'react'

interface ScanStatus {
  status: string
  progress: number
  message?: string
  startedAt?: string
  finishedAt?: string
  rateLimitResetAt?: string
  totalCount: number
  jobId?: string
  hasToken?: boolean
}

interface ScanParams {
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

interface RepoResult {
  id: string
  repoUrl: string
  fullName: string
  score: number
  stars: number
  forks?: number | null
  openIssues?: number | null
  openPullRequests?: number | null
  totalIssues?: number | null
  totalPullRequests?: number | null
  contributors?: number | null
  language?: string | null
  description?: string | null
  clonedAt?: string | null
  clonePath?: string | null
  pushedAt: string
  evidenceSummary: string[]
  evidenceCount: number
}

export default function Home() {
  const [status, setStatus] = useState<ScanStatus>({
    status: 'idle',
    progress: 0,
    totalCount: 0,
    hasToken: false,
  })
  const [results, setResults] = useState<RepoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [params, setParams] = useState<ScanParams>({
    minScore: 2, // Lowered from 4 - repos get 2 points for tool mention, need code search for more
    maxRepos: 80,
    repoPages: 2,
    codePages: 1,
  })
  const [filters, setFilters] = useState({
    minScore: '',
    language: '',
    pushedAfter: '',
    starsMin: '',
  })
  
  // Pre-loaded intelligent search terms
  const defaultRepoQueries = [
    '("vibe coding" OR vibecoding OR "prompt-driven" OR "AI-assisted" OR "built with Cursor" OR "Cursor AI") in:readme',
    '("GitHub Copilot" OR Copilot OR Windsurf OR "Claude Code" OR aider OR "Continue.dev") in:readme',
    '("LangGraph" OR AutoGen OR CrewAI) in:readme',
  ]
  
  const defaultCodeQueries = [
    'filename:prompts.md OR filename:agent.md OR filename:SYSTEM_PROMPT.md',
    'path:.cursor OR "Cursor rules"',
  ]
  
  const [repoQueries, setRepoQueries] = useState<string[]>(defaultRepoQueries)
  const [codeQueries, setCodeQueries] = useState<string[]>(defaultCodeQueries)
  
  // Intelligent presets
  const intelligentPresets = {
    'cursor': {
      name: 'Cursor AI Focus',
      repoQueries: [
        '("Cursor AI" OR "built with Cursor" OR "Cursor rules" OR ".cursor") in:readme',
        'path:.cursor in:readme',
      ],
      codeQueries: [
        'path:.cursor',
        'filename:.cursorrules',
      ],
    },
    'copilot': {
      name: 'GitHub Copilot Focus',
      repoQueries: [
        '("GitHub Copilot" OR Copilot) in:readme',
        '("built with Copilot" OR "Copilot-powered") in:readme',
      ],
      codeQueries: [
        'Copilot in:file',
      ],
    },
    'ai-agents': {
      name: 'AI Agents & Frameworks',
      repoQueries: [
        '("LangGraph" OR AutoGen OR CrewAI OR "AI agent" OR "autonomous agent") in:readme',
        '("LangChain" OR "LlamaIndex" OR "AgentGPT") in:readme',
      ],
      codeQueries: [
        'filename:agent.py OR filename:agent.ts OR filename:agent.js',
        'filename:system_prompt.txt OR filename:system_prompt.md',
      ],
    },
    'comprehensive': {
      name: 'Comprehensive Search',
      repoQueries: defaultRepoQueries,
      codeQueries: defaultCodeQueries,
    },
  }

  useEffect(() => {
    fetchStatus()
    fetchResults()
    // Poll status every 2 seconds if scanning
    const interval = setInterval(() => {
      if (status.status === 'running') {
        fetchStatus()
        fetchResults()
      }
    }, 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.status])

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/scan/status')
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  const fetchResults = async () => {
    try {
      const queryParams = new URLSearchParams()
      if (filters.minScore) queryParams.set('minScore', filters.minScore)
      if (filters.language) queryParams.set('language', filters.language)
      if (filters.pushedAfter) queryParams.set('pushedAfter', filters.pushedAfter)
      if (filters.starsMin) queryParams.set('starsMin', filters.starsMin)

      const res = await fetch(`/api/results?${queryParams.toString()}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Error fetching results:', error)
    }
  }

  const handleStartScan = async () => {
    setLoading(true)
    try {
      const scanParams = {
        ...params,
        customRepoQueries: repoQueries,
        customCodeQueries: codeQueries,
      }
      const res = await fetch('/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanParams),
      })
      if (res.ok) {
        fetchStatus()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error starting scan:', error)
      alert('Failed to start scan')
    } finally {
      setLoading(false)
    }
  }

  const handleStopScan = async () => {
    setLoading(true)
    try {
      await fetch('/api/scan/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: status.jobId }),
      })
      fetchStatus()
    } catch (error) {
      console.error('Error stopping scan:', error)
      alert('Failed to stop scan')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const queryParams = new URLSearchParams()
      if (filters.minScore) queryParams.set('minScore', filters.minScore)
      if (filters.pushedAfter) queryParams.set('pushedAfter', filters.pushedAfter)
      if (filters.starsMin) queryParams.set('starsMin', filters.starsMin)

      const res = await fetch(`/api/results/export?${queryParams.toString()}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vibe-repos-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV')
    }
  }

  const handleFilterChange = () => {
    fetchResults()
  }
  
  const handleAddRepoQuery = () => {
    setRepoQueries([...repoQueries, ''])
  }
  
  const handleRemoveRepoQuery = (index: number) => {
    setRepoQueries(repoQueries.filter((_, i) => i !== index))
  }
  
  const handleUpdateRepoQuery = (index: number, value: string) => {
    const updated = [...repoQueries]
    updated[index] = value
    setRepoQueries(updated)
  }
  
  const handleAddCodeQuery = () => {
    setCodeQueries([...codeQueries, ''])
  }
  
  const handleRemoveCodeQuery = (index: number) => {
    setCodeQueries(codeQueries.filter((_, i) => i !== index))
  }
  
  const handleUpdateCodeQuery = (index: number, value: string) => {
    const updated = [...codeQueries]
    updated[index] = value
    setCodeQueries(updated)
  }
  
  const handleLoadPreset = (presetKey: string) => {
    const preset = intelligentPresets[presetKey as keyof typeof intelligentPresets]
    if (preset) {
      setRepoQueries([...preset.repoQueries])
      setCodeQueries([...preset.codeQueries])
    }
  }
  
  const handleResetToDefaults = () => {
    setRepoQueries([...defaultRepoQueries])
    setCodeQueries([...defaultCodeQueries])
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'rate_limited':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl">🚀</div>
            <h1 className="text-4xl font-bold text-white">Vibe Repo Finder</h1>
          </div>
          <p className="text-blue-100 text-lg">Discover GitHub repositories built with AI-powered development tools</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Intelligent Search Terms */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 mb-6 transition-shadow hover:shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <h2 className="text-2xl font-bold text-gray-900">Intelligent Search Terms</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetToDefaults}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
          
          {/* Intelligent Presets */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Quick Presets:</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(intelligentPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleLoadPreset(key)}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Repository Search Queries */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">Repository Search Queries:</label>
              <button
                onClick={handleAddRepoQuery}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Add Query
              </button>
            </div>
            <div className="space-y-2">
              {repoQueries.map((query, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <textarea
                    value={query}
                    onChange={(e) => handleUpdateRepoQuery(index, e.target.value)}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                    rows={2}
                    placeholder="Enter GitHub search query (e.g., 'Cursor AI' in:readme)"
                  />
                  <button
                    onClick={() => handleRemoveRepoQuery(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove query"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              💡 Tip: Use GitHub search syntax. Each query searches repositories. Examples: &quot;Cursor AI&quot; in:readme, language:TypeScript &quot;AI-assisted&quot;
            </p>
          </div>
          
          {/* Code Search Queries */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">Code Search Queries:</label>
              <button
                onClick={handleAddCodeQuery}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Add Query
              </button>
            </div>
            <div className="space-y-2">
              {codeQueries.map((query, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <textarea
                    value={query}
                    onChange={(e) => handleUpdateCodeQuery(index, e.target.value)}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                    rows={2}
                    placeholder="Enter code search query (e.g., filename:prompts.md)"
                  />
                  <button
                    onClick={() => handleRemoveCodeQuery(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove query"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              💡 Tip: Search for specific files or paths. Examples: filename:prompts.md, path:.cursor, &quot;Cursor rules&quot;
            </p>
          </div>
        </div>

        {/* Scan Controls */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 mb-6 transition-shadow hover:shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-2xl font-bold text-gray-900">Scan Controls</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Min Score
              </label>
              <input
                type="number"
                value={params.minScore}
                onChange={(e) => setParams({ ...params, minScore: parseInt(e.target.value) || 4 })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Max Repos
              </label>
              <input
                type="number"
                value={params.maxRepos}
                onChange={(e) => setParams({ ...params, maxRepos: parseInt(e.target.value) || 80 })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Repo Pages
              </label>
              <input
                type="number"
                value={params.repoPages}
                onChange={(e) => setParams({ ...params, repoPages: parseInt(e.target.value) || 2 })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Code Pages
              </label>
              <input
                type="number"
                value={params.codePages}
                onChange={(e) => setParams({ ...params, codePages: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.fetchMetadata || false}
                onChange={(e) => setParams({ ...params, fetchMetadata: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Fetch Metadata (Issues, PRs, Contributors) - Uses more API calls
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.cloneRepos || false}
                onChange={(e) => setParams({ ...params, cloneRepos: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Clone Repositories - Uses disk space
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartScan}
              disabled={loading || status.status === 'running'}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>▶️</span>
              <span>Run Scan</span>
            </button>
            <button
              onClick={handleStopScan}
              disabled={loading || status.status !== 'running'}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>⏹️</span>
              <span>Stop Scan</span>
            </button>
          </div>
        </div>

        {/* GitHub Token Warning */}
        {status.hasToken === false && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-semibold text-yellow-800">GitHub Token Not Configured</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Without a GitHub token, you&apos;re limited to <strong>60 requests/hour</strong> (very low!).</p>
                  <p className="mt-1">Add <code className="bg-yellow-100 px-1 rounded">GITHUB_TOKEN</code> to your <code className="bg-yellow-100 px-1 rounded">.env</code> file to get <strong>5,000 requests/hour</strong>.</p>
                  <p className="mt-2 text-xs">Get a token at: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline font-medium">github.com/settings/tokens</a> (select <code className="bg-yellow-100 px-1 rounded">public_repo</code> scope)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Panel */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">📊</span>
            <h2 className="text-2xl font-bold text-gray-900">Status Dashboard</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Current Status</div>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(status.status)} shadow-sm`}>
                {status.status === 'running' && '🔄 '}
                {status.status === 'completed' && '✅ '}
                {status.status === 'failed' && '❌ '}
                {status.status === 'rate_limited' && '⚠️ '}
                {status.status === 'canceled' && '⏸️ '}
                {status.status === 'idle' && '⏸️ '}
                {status.status}
              </span>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
              <div className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Progress</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-gray-900 min-w-[3rem]">{status.progress}%</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Total Repositories</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {status.totalCount}
              </div>
            </div>
          </div>
          {status.message && (
            <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded text-sm text-gray-700">
              <strong>ℹ️ Info:</strong> {status.message}
            </div>
          )}
          {status.rateLimitResetAt && (
            <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded text-sm text-yellow-800">
              <strong>⚠️ Rate Limit Exceeded:</strong> Resets at {new Date(status.rateLimitResetAt).toLocaleString()}
              {!status.hasToken && (
                <p className="mt-1 text-xs">Add GITHUB_TOKEN to .env to avoid this limit.</p>
              )}
            </div>
          )}
          {status.finishedAt && (
            <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
              <span>🕐</span>
              <span>Last run: {new Date(status.finishedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">🔍</span>
            <h2 className="text-2xl font-bold text-gray-900">Filters & Export</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Min Score
              </label>
              <input
                type="number"
                value={filters.minScore}
                onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
                onBlur={handleFilterChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Language (optional)
              </label>
              <input
                type="text"
                value={filters.language}
                onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                onBlur={handleFilterChange}
                placeholder="e.g., TypeScript"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pushed After (optional)
              </label>
              <input
                type="date"
                value={filters.pushedAfter}
                onChange={(e) => setFilters({ ...filters, pushedAfter: e.target.value })}
                onBlur={handleFilterChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Min Stars (optional)
              </label>
              <input
                type="number"
                value={filters.starsMin}
                onChange={(e) => setFilters({ ...filters, starsMin: e.target.value })}
                onBlur={handleFilterChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>📥</span>
              <span>Export CSV</span>
            </button>
            <button
              onClick={async () => {
                const confirmed = confirm(
                  'This will fetch metadata (forks, issues, PRs, contributors, language) for repositories that are missing it.\n\n' +
                  '⚠️ This uses GitHub API calls (6 per repo) and may take several minutes.\n' +
                  'If you hit rate limits, click the button again to continue.\n\n' +
                  'Continue?'
                )
                if (confirmed) {
                  try {
                    setLoading(true)
                    const res = await fetch('/api/results/backfill-metadata', { method: 'POST' })
                    const data = await res.json()
                    const message = data.remaining > 0
                      ? `✅ ${data.message}\n\nProcessed: ${data.processed}/${data.total}\nRemaining: ${data.remaining}\n\nClick "Backfill Metadata" again to continue.`
                      : `✅ ${data.message}\n\nProcessed: ${data.processed}/${data.total} repositories.`
                    alert(message)
                    fetchResults() // Refresh results
                  } catch (error) {
                    alert('❌ Error backfilling metadata: ' + (error instanceof Error ? error.message : 'Unknown error'))
                  } finally {
                    setLoading(false)
                  }
                }
              }}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🔄</span>
              <span>Backfill Metadata</span>
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <h2 className="text-2xl font-bold text-gray-900">Results</h2>
              </div>
              <span className="px-4 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                {results.length} {results.length === 1 ? 'repository' : 'repositories'}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    ⭐ Stars
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    🍴 Forks
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    🐛 Issues
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    🔀 PRs
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    👥 Contributors
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Evidence
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">🔍</span>
                        <p className="text-gray-500 font-medium">No results found</p>
                        <p className="text-sm text-gray-400">Start a scan to discover repositories</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  results.map((repo) => (
                    <tr key={repo.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={repo.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-2 group"
                        >
                          <span>🔗</span>
                          <span>{repo.fullName}</span>
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1.5 text-sm font-bold rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm">
                          {repo.score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-sm font-semibold text-gray-900">{repo.stars?.toLocaleString() || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {repo.forks !== null && repo.forks !== undefined ? repo.forks.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {repo.openIssues !== null && repo.openIssues !== undefined ? (
                          <div className="flex flex-col">
                            <span className="text-red-600 font-semibold">{repo.openIssues}</span>
                            {repo.totalIssues !== null && repo.totalIssues !== undefined && (
                              <span className="text-xs text-gray-500">/ {repo.totalIssues} total</span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {repo.openPullRequests !== null && repo.openPullRequests !== undefined ? (
                          <div className="flex flex-col">
                            <span className="text-green-600 font-semibold">{repo.openPullRequests}</span>
                            {repo.totalPullRequests !== null && repo.totalPullRequests !== undefined && (
                              <span className="text-xs text-gray-500">/ {repo.totalPullRequests} total</span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {repo.contributors !== null && repo.contributors !== undefined ? repo.contributors : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {repo.language ? (
                          <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                            {repo.language}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(repo.pushedAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="max-w-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                              {repo.evidenceCount} evidence
                            </span>
                          </div>
                          {repo.evidenceSummary.length > 0 && (
                            <div className="text-xs text-gray-500 line-clamp-2">
                              {repo.evidenceSummary.slice(0, 2).join(' • ')}
                              {repo.evidenceSummary.length > 2 && ` • +${repo.evidenceSummary.length - 2} more`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/repos/clone', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ repoId: repo.id, repoUrl: repo.repoUrl, fullName: repo.fullName }),
                              })
                              const data = await res.json()
                              if (data.success) {
                                alert(`Repository cloned to: ${data.path}`)
                                fetchResults() // Refresh to show cloned status
                              } else {
                                alert(`Clone failed: ${data.error}`)
                              }
                            } catch (error) {
                              alert('Failed to clone repository')
                            }
                          }}
                          disabled={!!repo.clonedAt}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            repo.clonedAt
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                          title={repo.clonedAt ? `Cloned to: ${repo.clonePath}` : 'Clone repository'}
                        >
                          {repo.clonedAt ? '✓ Cloned' : '📥 Clone'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}


