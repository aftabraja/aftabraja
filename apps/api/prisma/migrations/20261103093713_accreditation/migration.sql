-- CreateTable
CREATE TABLE "AccredConfig" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "backText" TEXT NOT NULL,
    "sponsorLogoUrl" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "showIdLast4" BOOLEAN NOT NULL DEFAULT false,
    "selfApplyOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccredConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccredZone" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccredZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccredCategory" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresIdCheck" BOOLEAN NOT NULL DEFAULT true,
    "selfApply" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccredCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accreditation" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "cardNo" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "organisation" TEXT,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "idType" TEXT,
    "idLast4" TEXT,
    "idVerified" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "source" TEXT NOT NULL DEFAULT 'LEAGUE',
    "notes" TEXT,
    "printedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accreditation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccredScan" (
    "id" TEXT NOT NULL,
    "accreditationId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccredScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccredConfig_leagueId_key" ON "AccredConfig"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "AccredZone_leagueId_code_key" ON "AccredZone"("leagueId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Accreditation_code_key" ON "Accreditation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Accreditation_leagueId_cardNo_key" ON "Accreditation"("leagueId", "cardNo");

-- AddForeignKey
ALTER TABLE "AccredConfig" ADD CONSTRAINT "AccredConfig_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccredZone" ADD CONSTRAINT "AccredZone_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccredCategory" ADD CONSTRAINT "AccredCategory_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccredCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccredScan" ADD CONSTRAINT "AccredScan_accreditationId_fkey" FOREIGN KEY ("accreditationId") REFERENCES "Accreditation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
