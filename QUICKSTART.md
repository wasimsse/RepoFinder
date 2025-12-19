# Quick Start Guide

## Running the Application

### Step 1: Set up Environment Variables

Make sure your `.env` file has at least:

```env
DATABASE_URL="file:./prisma/dev.db"
GITHUB_TOKEN=your_github_token_here
```

**Getting a GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "Vibe Repo Finder"
4. Select the `public_repo` scope (or `repo` for private repos)
5. Click "Generate token" and copy it
6. Paste it into your `.env` file

**Note**: The token is optional but highly recommended. Without it, you'll only have 60 requests/hour instead of 5,000.

### Step 2: Set up Database

Run the database migration:

```bash
npm run db:migrate
```

This will create the SQLite database file at `prisma/dev.db`.

### Step 3: Start the Development Server

```bash
npm run dev
```

### Step 4: Open in Browser

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Using the App

1. **Configure scan parameters** (optional):
   - Min Score: Minimum score threshold (default: 4)
   - Max Repos: Maximum repositories to scan (default: 80)
   - Repo Pages: Pages to fetch from repo search (default: 2)
   - Code Pages: Pages to fetch from code search (default: 1)

2. **Click "Run Scan"** to start scanning GitHub

3. **Monitor progress** in the Status panel

4. **Filter results** using the Filters section

5. **Export to CSV** using the "Export CSV" button

## Troubleshooting

### Database not found
If you see database errors, run:
```bash
npm run db:migrate
```

### Rate limit errors
- Make sure `GITHUB_TOKEN` is set in `.env`
- Wait for the rate limit to reset (shown in the Status panel)

### Build errors
Make sure all dependencies are installed:
```bash
npm install
```

