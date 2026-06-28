/**
 * CSV Utility Functions for Client-Side CSV Generation
 */

/**
 * Converts an array of objects to CSV string
 */
export function objectsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCSVField).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => escapeCSVField(String(row[h] ?? ''))).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Escapes a CSV field value (handles quotes, commas, newlines)
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Creates a Blob from CSV content
 */
export function createCsvBlob(csvContent: string): Blob {
  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  return new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Downloads CSV content as a file
 */
export function downloadCsv(filename: string, headers: string[], rows: Record<string, unknown>[]): void {
  const csvContent = objectsToCsv(headers, rows);
  const blob = createCsvBlob(csvContent);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Streams CSV content (returns an async generator for large datasets)
 */
export async function* streamCsvRows(
  headers: string[], 
  rows: Record<string, unknown>[],
  chunkSize: number = 100
): AsyncGenerator<string, void, unknown> {
  // Yield header first
  yield headers.map(escapeCSVField).join(',') + '\n';
  
  // Yield rows in chunks
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const csvChunk = chunk
      .map(row => headers.map(h => escapeCSVField(String(row[h] ?? ''))).join(','))
      .join('\n');
    yield csvChunk + '\n';
  }
}
