# Vibe Repo Finder 🚀

A Next.js web application that automatically finds and stores GitHub repositories likely developed using "vibe coding" workflows (Cursor/Copilot/Windsurf/prompt-driven/agentic development).

![Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🌟 Features

- **🧠 Intelligent Search**: Pre-loaded and customizable search queries for finding AI-assisted development repositories
- **📊 Comprehensive Metadata**: Collects issues, PRs, forks, contributors, language, and more
- **🔍 Advanced Filtering**: Filter by score, stars, language, date, and more
- **💾 Repository Cloning**: Optional one-click cloning of repositories
- **📥 CSV Export**: Export results for further analysis
- **⚡ Real-time Progress**: Live status updates during scanning
- **🎯 Smart Scoring**: Heuristic-based scoring system for repository relevance
- **🔄 Rate Limit Handling**: Automatic detection and graceful handling of GitHub API limits

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- GitHub Personal Access Token (recommended for higher rate limits)
- Git (optional, for cloning functionality)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/wasimsse/RepoFinder.git
   cd RepoFinder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your GitHub token:
   ```env
   GITHUB_TOKEN=your_github_token_here
   DATABASE_URL="file:./prisma/dev.db"
   CRON_SECRET=your_secret_for_cron_endpoint  # Optional
   ```

   **Getting a GitHub Token:**
   - Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Select the `public_repo` scope (or `repo` for private repos)
   - Copy the token to your `.env` file
   - **Note**: Without a token, you're limited to 60 requests/hour. With a token, you get 5,000 requests/hour.

4. **Initialize the database:**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage Guide

### Running a Scan

1. **Configure Scan Parameters:**
   - **Min Score**: Minimum relevance score (default: 2)
   - **Max Repos**: Maximum repositories to scan (default: 80)
   - **Repo Pages**: Number of pages to fetch from repository search (default: 2)
   - **Code Pages**: Number of pages to fetch from code search (default: 1)

2. **Customize Search Terms (Optional):**
   - Use pre-loaded intelligent presets or create custom queries
   - Edit repository search queries for finding repos
   - Edit code search queries for finding evidence files

3. **Enable Optional Features:**
   - ✅ **Fetch Metadata**: Get issues, PRs, contributors (uses more API calls)
   - ✅ **Clone Repositories**: Automatically clone found repos (uses disk space)

4. **Click "Run Scan"** and monitor progress in the Status Dashboard

### Filtering Results

Use the Filters section to refine results:
- **Min Score**: Filter by relevance score
- **Language**: Filter by programming language
- **Pushed After**: Only show repos updated after a specific date
- **Min Stars**: Filter by minimum star count

### Exporting Results

Click the **"Export CSV"** button to download all filtered results as a CSV file.

### Cloning Repositories

- Click the **"📥 Clone"** button next to any repository in the results table
- Cloned repos are stored in `./repos/` directory
- Clone status is tracked in the database

## 🏗️ Project Structure

```
.
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── scan/            # Scan control endpoints
│   │   ├── results/         # Results retrieval & export
│   │   ├── repos/           # Repository cloning endpoints
│   │   ├── cron/            # Scheduled scan endpoint
│   │   └── test/            # Testing endpoints
│   ├── page.tsx             # Main dashboard UI
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── lib/                      # Core libraries
│   ├── db.ts                # Prisma database client
│   ├── github.ts            # GitHub API wrapper
│   ├── scanner.ts           # Repository scanner service
│   └── clone.ts             # Repository cloning service
├── prisma/                   # Database schema & migrations
│   ├── schema.prisma        # Database models
│   └── migrations/          # Migration files
└── repos/                    # Cloned repositories (gitignored)
```

## 🔧 API Endpoints

### Scan Control
- `POST /api/scan/start` - Start a new scan
- `GET /api/scan/status` - Get current scan status
- `POST /api/scan/stop` - Stop the current scan

### Results
- `GET /api/results` - Get paginated results with filters
- `GET /api/results/export` - Export results as CSV

### Repository Cloning
- `POST /api/repos/clone` - Clone a single repository
- `POST /api/repos/clone-batch` - Clone multiple repositories

### Cron
- `POST /api/cron/scan` - Trigger scheduled scan (requires CRON_SECRET)

## 🎯 How It Works

### Repository Detection

The scanner uses multiple search strategies:

1. **Repository Search** (searches README files):
   - `"vibe coding" OR vibecoding OR "prompt-driven" OR "AI-assisted" OR "built with Cursor" OR "Cursor AI"` in:readme
   - `"GitHub Copilot" OR Copilot OR Windsurf OR "Claude Code" OR aider OR "Continue.dev"` in:readme
   - `"LangGraph" OR AutoGen OR CrewAI` in:readme

2. **Code Search** (searches code files):
   - `filename:prompts.md OR filename:agent.md OR filename:SYSTEM_PROMPT.md`
   - `path:.cursor OR "Cursor rules"`

### Scoring System

Repositories are scored based on evidence found:

- **Tool mention in README/description**: +2 points
- **Prompt artifact file** (prompts.md, agent.md, SYSTEM_PROMPT.md): +3 points
- **Cursor fingerprint** (.cursor directory or "Cursor rules"): +3 points

Scores are cumulative - a repository can have multiple pieces of evidence.

### Database Schema

**RepoCandidate:**
- Repository URL, name, score, stars, forks
- Issues (open/total), Pull Requests (open/total)
- Contributors count, language, description
- Evidence summary, clone status

**ScanJob:**
- Job status, progress, timestamps
- Parameters, rate limit tracking
- Cancellation support

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio (database GUI)
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No* | GitHub Personal Access Token (*highly recommended) |
| `DATABASE_URL` | Yes | SQLite database path (default: `file:./prisma/dev.db`) |
| `CRON_SECRET` | No | Secret for protecting cron endpoint |

### Rate Limits

- **Without token**: 60 requests/hour (very limited)
- **With token**: 5,000 requests/hour (recommended)

The app automatically detects rate limits and pauses/reschedules scans when limits are reached.

## 🔄 Scheduled Scans (Cron)

To enable automatic daily scans:

### Option 1: Vercel Cron

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/scan",
    "schedule": "0 2 * * *"
  }]
}
```

### Option 2: GitHub Actions

Create `.github/workflows/cron-scan.yml`:
```yaml
name: Daily Scan
on:
  schedule:
    - cron: '0 2 * * *'  # Run at 2 AM UTC daily
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scan
        run: |
          curl -X POST https://your-app-url.vercel.app/api/cron/scan \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## 📝 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute and areas for improvement.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database powered by [Prisma](https://www.prisma.io/)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)
- GitHub API integration

## 📧 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Made with ❤️ for the AI-assisted development community**
