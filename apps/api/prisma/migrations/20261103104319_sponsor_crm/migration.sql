-- CreateTable
CREATE TABLE "SponsorDeal" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sponsorUserId" TEXT,
    "opportunityId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "expectedClose" TIMESTAMP(3),
    "ownerId" TEXT,
    "ownerName" TEXT,
    "lostReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "conversationId" TEXT,
    "contractId" TEXT,
    "deckId" TEXT,
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorDeliverable" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'OTHER',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "proofs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorDeliverable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SponsorDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorDeliverable" ADD CONSTRAINT "SponsorDeliverable_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SponsorDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
