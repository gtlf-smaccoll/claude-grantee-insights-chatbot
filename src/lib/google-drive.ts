import { google } from "googleapis";
import { getGoogleAuthClient } from "./google-auth";
import { DriveFileInfo } from "@/types/documents";

function getDriveClient() {
  const auth = getGoogleAuthClient([
    "https://www.googleapis.com/auth/drive.readonly",
  ]);
  return google.drive({ version: "v3", auth });
}

/**
 * List all files in a Google Drive folder. Handles pagination.
 * Returns metadata for each file (id, name, mimeType, etc.)
 */
export async function listFilesInFolder(
  folderId: string
): Promise<DriveFileInfo[]> {
  const drive = getDriveClient();
  const files: DriveFileInfo[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of response.data.files ?? []) {
      files.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        modifiedTime: file.modifiedTime!,
        size: file.size ?? undefined,
        webViewLink: file.webViewLink ?? undefined,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * List files recursively, including files inside subfolders.
 */
export async function listFilesRecursive(
  folderId: string
): Promise<DriveFileInfo[]> {
  const drive = getDriveClient();
  const allFiles: DriveFileInfo[] = [];

  // Get direct children
  const children = await listFilesInFolder(folderId);

  for (const child of children) {
    if (child.mimeType === "application/vnd.google-apps.folder") {
      // Recurse into subfolders
      const subFiles = await listFilesRecursive(child.id);
      allFiles.push(...subFiles);
    } else {
      allFiles.push(child);
    }
  }

  return allFiles;
}

/**
 * Download file content as a Buffer (for PDF, DOCX, etc.)
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Export a Google Docs file as plain text.
 * Works for Google Docs (application/vnd.google-apps.document).
 */
export async function exportGoogleDoc(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const response = await drive.files.export({
    fileId,
    mimeType: "text/plain",
  });
  return response.data as string;
}
