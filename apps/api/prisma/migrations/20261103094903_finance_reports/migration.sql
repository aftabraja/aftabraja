-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "approval" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidOn" TIMESTAMP(3),
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "tdsAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "party" TEXT,
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "receivedOn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "expenseApprovalLimit" INTEGER;
