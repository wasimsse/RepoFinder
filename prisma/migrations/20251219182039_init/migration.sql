-- CreateTable
CREATE TABLE "RepoCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoUrl" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "pushedAt" DATETIME NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "params" TEXT,
    "rateLimitResetAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RepoCandidate_repoUrl_key" ON "RepoCandidate"("repoUrl");

-- CreateIndex
CREATE INDEX "RepoCandidate_score_idx" ON "RepoCandidate"("score");

-- CreateIndex
CREATE INDEX "RepoCandidate_stars_idx" ON "RepoCandidate"("stars");

-- CreateIndex
CREATE INDEX "RepoCandidate_pushedAt_idx" ON "RepoCandidate"("pushedAt");

-- CreateIndex
CREATE INDEX "ScanJob_status_idx" ON "ScanJob"("status");
