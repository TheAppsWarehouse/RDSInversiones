/**
 * excelService.ts
 * Base/web fallback — xlsx is not available on web.
 * On native, excelService.native.ts takes priority automatically.
 */

export async function exportToExcel(
  _sheetName: string,
  _rows: Record<string, any>[],
  _filename: string
): Promise<void> {
  console.warn('exportToExcel is not supported on this platform.');
}

export async function importFromExcel(): Promise<any[][] | null> {
  console.warn('importFromExcel is not supported on this platform.');
  return null;
}
