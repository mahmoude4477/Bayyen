import "server-only";
import { STORAGE_DISABLED_MESSAGE } from "@/lib/storage-config";

/*
 * MinIO / S3 implementation is temporarily disabled.
 *
 * The previous implementation created S3 clients from STORAGE_ENDPOINT,
 * STORAGE_PUBLIC_ENDPOINT and STORAGE_ANALYZER_ENDPOINT, then generated signed
 * upload/download URLs. It must only be restored after a real HTTPS production
 * bucket and its CORS policy are configured.
 */

function storageDisabled(): never {
  throw new Error(STORAGE_DISABLED_MESSAGE);
}

export async function ensurePrivateBucket(): Promise<void> {
  storageDisabled();
}

export async function presignDownload(_objectKey: string): Promise<string> {
  void _objectKey;
  storageDisabled();
}

export async function presignBrowserDownload(_objectKey: string): Promise<string> {
  void _objectKey;
  storageDisabled();
}

export async function inspectObject(_objectKey: string): Promise<{ ContentLength?: number; ContentType?: string }> {
  void _objectKey;
  storageDisabled();
}

export async function presignUpload(_input: { objectKey: string; contentType: string; checksum?: string }): Promise<string> {
  void _input;
  storageDisabled();
}
