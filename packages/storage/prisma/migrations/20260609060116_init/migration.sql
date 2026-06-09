-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "password" TEXT,
    "wxOpenId" TEXT,
    "name" TEXT,
    "llmKeyEnc" TEXT,
    "llmBaseUrl" TEXT,
    "llmModel" TEXT,
    "llmKind" TEXT,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "freeQuota" INTEGER NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "mode" TEXT NOT NULL DEFAULT 'work',
    "workspaceRoot" TEXT,
    "remoteUser" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "interruptedTurn" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "toolName" TEXT,
    "pendingEditId" TEXT,
    "pendingEditPath" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "finalText" TEXT,
    "startedAt" BIGINT NOT NULL,
    "endedAt" BIGINT,
    "chunks" JSONB NOT NULL DEFAULT '[]',
    "tools" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_wxOpenId_key" ON "User"("wxOpenId");

-- CreateIndex
CREATE INDEX "Session_userId_updatedAt_idx" ON "Session"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Session_remoteUser_idx" ON "Session"("remoteUser");

-- CreateIndex
CREATE INDEX "Message_sessionId_ts_idx" ON "Message"("sessionId", "ts");

-- CreateIndex
CREATE INDEX "Turn_sessionId_startedAt_idx" ON "Turn"("sessionId", "startedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
