-- File contents stored in the database, for deployments with no object storage.
-- Kept in its own table so listing the media library never reads the bytes.
CREATE TABLE "storage_blobs" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_blobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_blobs_fileId_key" ON "storage_blobs"("fileId");

ALTER TABLE "storage_blobs" ADD CONSTRAINT "storage_blobs_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "storage_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
