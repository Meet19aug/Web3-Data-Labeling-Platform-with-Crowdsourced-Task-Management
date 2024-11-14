/*
  Warnings:

  - You are about to drop the column `option_id` on the `Options` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Options" DROP COLUMN "option_id";

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "title" SET DEFAULT 'Select the most suitable thumbnail';
