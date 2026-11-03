-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "milestones" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "JerseyRules" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueLogoSlot" TEXT NOT NULL DEFAULT 'CHEST_RIGHT',
    "teamLogoSlot" TEXT NOT NULL DEFAULT 'CHEST_LEFT',
    "sponsorSlots" TEXT[] DEFAULT ARRAY['FRONT_CHEST', 'SLEEVE_LEFT', 'SLEEVE_RIGHT', 'LOWER_FRONT', 'BACK_TOP', 'BACK_BOTTOM']::TEXT[],
    "maxSizes" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JerseyRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JerseyDesign" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "kit" TEXT NOT NULL DEFAULT 'HOME',
    "template" TEXT NOT NULL DEFAULT 'classic',
    "colors" JSONB NOT NULL,
    "sponsors" JSONB NOT NULL DEFAULT '[]',
    "sampleName" TEXT NOT NULL DEFAULT 'PLAYER',
    "sampleNumber" TEXT NOT NULL DEFAULT '10',
    "roster" JSONB NOT NULL DEFAULT '[]',
    "extraSizes" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rfqId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JerseyDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JerseyRules_leagueId_key" ON "JerseyRules"("leagueId");
