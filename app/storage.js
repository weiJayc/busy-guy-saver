// Storage layer. No localStorage on purpose — tasks.json is the single
// source of truth and only ever lives on disk. Opening index.html directly
// (file://) also can't use the File System Access API's pickers (Chrome
// requires a secure context for showOpenFilePicker/showSaveFilePicker and
// throws SecurityError under file://), so "load" and "save" are plain
// <input type=file> / <a download> operations, which work fine under
// file:// too — the tradeoff is the user must explicitly import on open and
// export after every change they want kept.

function exportTasksToFile(tasks) {
  const blob = new Blob([JSON.stringify({ version: 1, tasks }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importTasksFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        resolve(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}
