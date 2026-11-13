/**
 * Recursively extracts files from a DataTransfer (drag-and-drop) traversing nested directories.
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<File[]> {
  const items = dataTransfer.items;
  if (!items || items.length === 0) {
    return Array.from(dataTransfer.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
  }

  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = (item as any).webkitGetAsEntry?.();
      if (entry) {
        entries.push(entry);
      } else {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) {
          entries.push({
            isFile: true,
            isDirectory: false,
            file: (cb: (f: File) => void) => cb(file),
            name: file.name,
          });
        }
      }
    }
  }

  const files: File[] = [];

  async function traverseEntry(entry: any, currentPath = ''): Promise<void> {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            if (file && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp|tiff?)$/i.test(file.name))) {
              const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
              Object.defineProperty(file, 'customRelativePath', {
                value: relPath,
                writable: true,
                configurable: true,
              });
              files.push(file);
            }
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readEntriesBatch = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries(resolve, () => resolve([]));
        });

      let done = false;
      while (!done) {
        const batch = await readEntriesBatch();
        if (batch.length === 0) {
          done = true;
        } else {
          for (const child of batch) {
            await traverseEntry(
              child,
              currentPath ? `${currentPath}/${entry.name}` : entry.name
            );
          }
        }
      }
    }
  }

  for (const entry of entries) {
    await traverseEntry(entry, '');
  }

  return files;
}

/**
 * Normalizes relative path separators and lowercase for robust comparison.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

/**
 * Checks whether an imported file matches a saved photo configuration.
 * Prioritizes matching relative subpaths, falling back to matching filename and size.
 */
export function isPhotoMatch(
  config: { name: string; relativePath?: string; size?: number },
  file: File
): boolean {
  const fileName = file.name.toLowerCase();
  const targetName = config.name.toLowerCase();

  const fileRelPath = normalizePath(
    (file as any).customRelativePath || file.webkitRelativePath || file.name
  );
  const targetRelPath = config.relativePath ? normalizePath(config.relativePath) : null;

  // 1. If relative path is available, check if the file ends with or equals the target relative path
  if (targetRelPath) {
    if (fileRelPath === targetRelPath) return true;
    if (fileRelPath.endsWith(`/${targetRelPath}`)) return true;
    if (targetRelPath.endsWith(`/${fileRelPath}`)) return true;
  }

  // 2. If filenames match
  if (fileName === targetName) {
    // If size is recorded, check size similarity
    if (typeof config.size === 'number' && config.size > 0) {
      return Math.abs(config.size - file.size) < 100;
    }
    return true;
  }

  return false;
}

