/**
 * Repository cloning service
 * Server-side only - uses Node.js APIs
 */

import 'server-only'

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

export interface CloneResult {
  success: boolean
  path?: string
  error?: string
}

export class RepoCloneService {
  private baseCloneDir: string

  constructor(baseDir: string = './repos') {
    this.baseCloneDir = baseDir
  }

  async cloneRepo(repoUrl: string, fullName: string): Promise<CloneResult> {
    try {
      // Create base directory if it doesn't exist
      await fs.mkdir(this.baseCloneDir, { recursive: true })

      // Convert fullName to safe directory name
      const safeDirName = fullName.replace('/', '_')
      const clonePath = path.join(this.baseCloneDir, safeDirName)

      // Check if already cloned
      try {
        await fs.access(clonePath)
        return {
          success: true,
          path: clonePath,
          error: 'Already exists',
        }
      } catch {
        // Directory doesn't exist, proceed with clone
      }

      // Clone the repository
      const { stdout, stderr } = await execAsync(
        `git clone --depth 1 ${repoUrl} "${clonePath}"`,
        {
          timeout: 120000, // 2 minute timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      )

      return {
        success: true,
        path: clonePath,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      }
    }
  }

  async cloneMultiple(repos: Array<{ url: string; fullName: string }>, onProgress?: (current: number, total: number) => void): Promise<CloneResult[]> {
    const results: CloneResult[] = []
    
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]
      const result = await this.cloneRepo(repo.url, repo.fullName)
      results.push(result)
      
      if (onProgress) {
        onProgress(i + 1, repos.length)
      }
      
      // Small delay between clones to avoid overwhelming the system
      if (i < repos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }

  async deleteClone(fullName: string): Promise<boolean> {
    try {
      const safeDirName = fullName.replace('/', '_')
      const clonePath = path.join(this.baseCloneDir, safeDirName)
      await fs.rm(clonePath, { recursive: true, force: true })
      return true
    } catch {
      return false
    }
  }

  getClonePath(fullName: string): string {
    const safeDirName = fullName.replace('/', '_')
    return path.join(this.baseCloneDir, safeDirName)
  }
}

