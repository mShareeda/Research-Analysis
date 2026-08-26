import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? "20");

export async function saveUpload(file: File) {
  if (file.size > maxUploadMb * 1024 * 1024) {
    throw new Error(`File is too large. Maximum upload size is ${maxUploadMb}MB.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const absoluteDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), uploadDir);
  const absolutePath = path.join(absoluteDir, storedName);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    bytes,
    filePath: absolutePath,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  };
}
