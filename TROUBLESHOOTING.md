# Troubleshooting Guide

## Issue: No Output/Results from Scans

### Root Causes Found:

1. **Database was empty** ✅ FIXED
   - The database file was 0 bytes
   - Solution: Run `npx prisma migrate reset --force` to recreate tables

2. **Default minScore too high** ✅ FIXED
   - Default was 4, but repos only get 2 points for tool mention
   - Without code search evidence, nothing passes the filter
   - Solution: Lowered default to 2

3. **Rate Limits (without GitHub token)**
   - Only 60 requests/hour without token
   - Scans can use 10-20+ requests each
   - Solution: Add GITHUB_TOKEN to .env file

### Quick Fixes:

1. **Reset Database:**
   ```bash
   npx prisma migrate reset --force
   ```

2. **Set lower minScore:**
   - In UI, set "Min Score" to 2 instead of 4
   - Or edit defaults in code

3. **Add GitHub Token:**
   ```bash
   # Add to .env file:
   GITHUB_TOKEN=your_token_here
   ```

### Testing:

Test the API directly:
```bash
# Test GitHub API
curl http://localhost:3000/api/test/github

# Test simple scan
curl -X POST http://localhost:3000/api/debug/scan-test \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'
```

### Current Status:

- ✅ Database tables created
- ✅ Default minScore lowered to 2
- ⚠️ Still need GitHub token for better rate limits
- ⚠️ Rate limits may still prevent scans if you've used up your 60/hour limit

