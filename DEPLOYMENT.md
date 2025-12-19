# Deployment Guide

## Local Development

See [README.md](README.md) for setup instructions.

## Production Deployment

### Option 1: Vercel (Recommended)

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

2. **Environment Variables:**
   Add these in Vercel dashboard:
   - `GITHUB_TOKEN` - Your GitHub Personal Access Token
   - `DATABASE_URL` - For production, use a proper database:
     - PostgreSQL: `postgresql://user:pass@host:5432/dbname`
     - MySQL: `mysql://user:pass@host:3306/dbname`
   - `CRON_SECRET` - Random secret for cron endpoint protection

3. **Database Setup:**
   - For SQLite: Not recommended for production
   - Use PostgreSQL or MySQL instead
   - Update `prisma/schema.prisma` datasource if needed
   - Run migrations: `npx prisma migrate deploy`

4. **Deploy:**
   - Push to `main` branch
   - Vercel auto-deploys

### Option 2: Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml:**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - DATABASE_URL=file:./prisma/dev.db
         - GITHUB_TOKEN=${GITHUB_TOKEN}
       volumes:
         - ./prisma:/app/prisma
   ```

3. **Run:**
   ```bash
   docker-compose up -d
   ```

### Option 3: Traditional Server

1. **Install dependencies:**
   ```bash
   npm install
   npm run build
   ```

2. **Set environment variables**

3. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Start production server:**
   ```bash
   npm start
   ```

5. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start npm --name "vibe-repo-finder" -- start
   pm2 save
   pm2 startup
   ```

## Database Migration

For production, migrate from SQLite to PostgreSQL/MySQL:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // or "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. Run migration:
   ```bash
   npx prisma migrate deploy
   ```

## Environment Variables Checklist

- [ ] `GITHUB_TOKEN` - GitHub Personal Access Token (required for production)
- [ ] `DATABASE_URL` - Database connection string
- [ ] `CRON_SECRET` - Secret for cron endpoint (if using scheduled scans)
- [ ] `NODE_ENV=production` - Set automatically by most platforms

## Security Considerations

1. **Never commit `.env` files**
2. **Use strong `CRON_SECRET`**
3. **Rotate `GITHUB_TOKEN` regularly**
4. **Enable rate limiting in production**
5. **Use HTTPS only**
6. **Implement authentication if multi-user**

## Monitoring

Consider adding:
- Application monitoring (Sentry, LogRocket)
- Uptime monitoring (UptimeRobot, Pingdom)
- Log aggregation (Datadog, LogDNA)

