-- AlterTable
ALTER TABLE "RepoCandidate" ADD COLUMN "clonePath" TEXT;
ALTER TABLE "RepoCandidate" ADD COLUMN "clonedAt" DATETIME;
ALTER TABLE "RepoCandidate" ADD COLUMN "contributors" INTEGER;
ALTER TABLE "RepoCandidate" ADD COLUMN "description" TEXT;
ALTER TABLE "RepoCandidate" ADD COLUMN "forks" INTEGER;
ALTER TABLE "RepoCandidate" ADD COLUMN "language" TEXT;
ALTER TABLE "RepoCandidate" ADD COLUMN "openIssues" INTEGER;
ALTER TABLE "RepoCandidate" ADD COLUMN "openPullRequests" INTEGER;
ALTER TABLE "RepoCandidate" ADD COLUMN "totalIssues" INTEGER;
ALTER TABLE "RepoCandidate" ADD COLUMN "totalPullRequests" INTEGER;

-- CreateIndex
CREATE INDEX "RepoCandidate_forks_idx" ON "RepoCandidate"("forks");

-- CreateIndex
CREATE INDEX "RepoCandidate_openIssues_idx" ON "RepoCandidate"("openIssues");
