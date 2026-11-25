/** A file that Excel opens directly (Ukrainian letters and columns are kept). */
export const downloadCsv = (fileName: string, header: string[], rows: unknown[][]) => {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = [header, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
