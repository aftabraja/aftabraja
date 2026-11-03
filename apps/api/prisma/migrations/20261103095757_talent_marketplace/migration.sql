-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TALENT_AGENT';

-- CreateTable
CREATE TABLE "AgencyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Agency',
    "city" TEXT,
    "website" TEXT,
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "playingRole" TEXT,
    "battingStyle" TEXT,
    "bowlingStyle" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "state" TEXT,
    "bornYear" INTEGER,
    "bio" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teamsPlayed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matches" INTEGER NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "forEndorsement" BOOLEAN NOT NULL DEFAULT true,
    "forLeagues" BOOLEAN NOT NULL DEFAULT false,
    "forAppearances" BOOLEAN NOT NULL DEFAULT true,
    "endorseFeeMin" INTEGER,
    "endorseFeeMax" INTEGER,
    "leagueFeeMin" INTEGER,
    "leagueFeeMax" INTEGER,
    "appearanceFeeMin" INTEGER,
    "appearanceFeeMax" INTEGER,
    "brandRestrictions" TEXT,
    "authorisedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentEnquiry" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "organisation" TEXT,
    "leagueId" TEXT,
    "budget" INTEGER,
    "dates" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyProfile_userId_key" ON "AgencyProfile"("userId");

-- AddForeignKey
ALTER TABLE "AgencyProfile" ADD CONSTRAINT "AgencyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentEnquiry" ADD CONSTRAINT "TalentEnquiry_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentEnquiry" ADD CONSTRAINT "TalentEnquiry_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
