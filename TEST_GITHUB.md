# Testing GitHub API Integration

## Quick Test

Run this to test if GitHub API is working:

```bash
curl http://localhost:3000/api/test/github
```

Or visit in browser: http://localhost:3000/api/test/github

## Simple Scan Test

Test with a simple query:

```bash
curl http://localhost:3000/api/test/simple-scan
```

Or visit: http://localhost:3000/api/test/simple-scan

## Current Issues

### Issue 1: No GitHub Token ⚠️
**Problem**: `GITHUB_TOKEN` is not set in `.env` file
**Impact**: Only 60 requests/hour (very limited!)
**Solution**: 
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select `public_repo` scope
4. Copy the token
5. Add to `.env` file: `GITHUB_TOKEN=your_token_here`
6. Restart the dev server

### Issue 2: Rate Limits
**Problem**: Without token, rate limits are very strict
**Solution**: Add token as described above

## Expected Behavior

With token:
- ✅ 5,000 requests/hour
- ✅ Can run multiple scans
- ✅ Better reliability

Without token:
- ⚠️ Only 60 requests/hour
- ⚠️ Scans may fail if rate limited
- ⚠️ Need to wait for reset (1 hour)

## Testing Your Setup

1. **Test API connectivity**:
   ```bash
   curl http://localhost:3000/api/test/github
   ```

2. **Test simple scan**:
   ```bash
   curl http://localhost:3000/api/test/simple-scan
   ```

3. **Check rate limits**:
   - Look at the `rateLimit.remaining` in the response
   - If it's low (< 10), wait or add a token

4. **Run a real scan**:
   - Open http://localhost:3000
   - Click "Run Scan"
   - Watch the status panel

