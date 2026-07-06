/**
 * excelService.web.ts
 * Web stub — xlsx / expo-file-system are not available on web.
 * Export/import functions are no-ops on the web platform.
 */

export async function exportToExcel(
  _sheetName: string,
  _rows: Record<string, any>[],
  _filename: string
): Promise<void> {
  // Not supported on web
  console.warn('exportToExcel is not supported on web.');
}

export async function importFromExcel(): Promise<any[][] | null> {
  // Not supported on web
  console.warn('importFromExcel is not supported on web.');
  return null;
}
