-- AlterTable
ALTER TABLE "LeagueStepProgress" ADD COLUMN     "alertLevel" TEXT,
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "broadcaster" TEXT,
ADD COLUMN     "offAirAt" TIMESTAMP(3),
ADD COLUMN     "onAirAt" TIMESTAMP(3),
ADD COLUMN     "streamUrl" TEXT,
ADD COLUMN     "tvSlot" TEXT;

-- CreateTable
CREATE TABLE "MatchChecklistItem" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneBy" TEXT,
    "doneAt" TIMESTAMP(3),
    "note" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "alerted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchChecklistItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MatchChecklistItem" ADD CONSTRAINT "MatchChecklistItem_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
