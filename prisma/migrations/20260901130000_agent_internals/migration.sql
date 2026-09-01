-- AlterTable: "inside its head" disclosure
ALTER TABLE "profiles"
    ADD COLUMN "systemPromptExcerpt" TEXT,
    ADD COLUMN "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "autonomy" TEXT,
    ADD COLUMN "memory" TEXT,
    ADD COLUMN "transcripts" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "profiles_tools_idx" ON "profiles" USING GIN ("tools");
