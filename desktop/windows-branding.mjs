import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resedit} from '@electron/packager/resedit';

export const iconPath=fileURLToPath(new URL('./system-builder.ico',import.meta.url));
export async function brandWindowsExecutable(exePath) {
  await resedit(path.resolve(exePath),{
    iconPath,
    productName:'System Builder',
    win32Metadata:{FileDescription:'System Builder',InternalName:'System Builder',OriginalFilename:'System Builder.exe'},
  });
}

