/**
 * SHA-256 Hash Utilities for AFROLOC Document Management
 * Used for document integrity verification and version tracking
 */

/**
 * Calculate SHA-256 hash of a file/blob
 * @param data - File content as ArrayBuffer or Uint8Array
 * @returns Hexadecimal hash string
 */
export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof Uint8Array) {
    buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
  } else {
    buffer = data;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate SHA-256 hash from a readable stream (for large files)
 * @param stream - ReadableStream of file content
 * @returns Hexadecimal hash string
 */
export async function sha256Stream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  
  // Combine all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  
  return sha256(combined);
}

/**
 * Calculate SHA-256 hash from a string
 * @param text - String to hash
 * @returns Hexadecimal hash string
 */
export async function sha256String(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return sha256(data);
}

/**
 * Verify file integrity by comparing hash
 * @param data - File content
 * @param expectedHash - Expected SHA-256 hash
 * @returns Boolean indicating if hashes match
 */
export async function verifyHash(
  data: ArrayBuffer | Uint8Array, 
  expectedHash: string
): Promise<boolean> {
  const actualHash = await sha256(data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
