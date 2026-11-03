-- AlterTable
ALTER TABLE "League" ADD COLUMN     "deptPermissions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "season" TEXT,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_leagueId_entityType_entityId_idx" ON "Comment"("leagueId", "entityType", "entityId");
