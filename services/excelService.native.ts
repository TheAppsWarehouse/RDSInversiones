/**
 * excelService.native.ts
 * Native (iOS/Android) implementation using xlsx + expo-file-system + expo-sharing.
 */
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export async function exportToExcel(
  sheetName: string,
  rows: Record<string, any>[],
  filename: string
): Promise<void> {
  const fallback = rows.length > 0 ? rows : [{}];
  const ws = XLSX.utils.json_to_sheet(fallback);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileUri = (FileSystem.documentDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(fileUri, buf, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri);
  }
}

export async function importFromExcel(): Promise<any[][] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const wb = XLSX.read(fileContent, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
}
