-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "draftOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "draftPrices" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "draftSnake" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxOverseas" INTEGER,
ADD COLUMN     "maxRetentions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'AUCTION',
ADD COLUMN     "roleMins" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rtmCards" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rtmTeamId" TEXT;

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "maxAge" INTEGER,
ADD COLUMN     "minAge" INTEGER,
ADD COLUMN     "regClosesAt" TIMESTAMP(3),
ADD COLUMN     "regDocs" TEXT[] DEFAULT ARRAY['ID_PROOF', 'AGE_PROOF']::TEXT[],
ADD COLUMN     "regFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "regMaxPlayers" INTEGER,
ADD COLUMN     "regOpensAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlayerRegistration" ADD COLUMN     "acquiredVia" TEXT,
ADD COLUMN     "feePaid" INTEGER,
ADD COLUMN     "feeStatus" TEXT,
ADD COLUMN     "kycNote" TEXT,
ADD COLUMN     "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "previousTeamId" TEXT;

-- CreateTable
CREATE TABLE "TeamStaff" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDocument" (
    "id" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "fileUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TeamStaff" ADD CONSTRAINT "TeamStaff_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_regId_fkey" FOREIGN KEY ("regId") REFERENCES "PlayerRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
