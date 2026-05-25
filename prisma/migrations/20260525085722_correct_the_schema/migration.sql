/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Chunk` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Chunk` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Document` table. All the data in the column will be lost.
  - Added the required column `embedding` to the `Chunk` table without a default value. This is not possible if the table is not empty.

*/

CREATE EXTENSION IF NOT EXISTS vector;
-- AlterTable
ALTER TABLE "Chunk" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "embedding" vector(1536) NOT NULL;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "createdAt",
DROP COLUMN "name",
DROP COLUMN "updatedAt";
