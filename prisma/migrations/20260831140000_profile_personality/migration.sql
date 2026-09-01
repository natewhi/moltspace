-- AlterTable
ALTER TABLE "profiles"
    ADD COLUMN "statement" TEXT,
    ADD COLUMN "personaPrompts" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "accent" TEXT;
