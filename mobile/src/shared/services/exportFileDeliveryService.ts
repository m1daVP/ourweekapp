import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { warnSafely } from '@/shared/services/safeLogService';

export interface ExportFileDelivery {
  content: string;
  fileName: string;
  mimeType: string;
  title?: string;
}

type WebNavigatorWithShare = Navigator & {
  canShare?: Navigator['canShare'];
};

export function downloadFileInBrowser(file: ExportFileDelivery) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = file.fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareFileInBrowser(file: ExportFileDelivery) {
  const exportedFile = new File([file.content], file.fileName, {
    type: file.mimeType,
  });
  const shareData: ShareData = {
    title: file.title ?? file.fileName,
    files: [exportedFile],
  };
  const webNavigator = navigator as WebNavigatorWithShare;

  if (!webNavigator.share || !webNavigator.canShare?.(shareData)) {
    return false;
  }

  await webNavigator.share(shareData);
  return true;
}

export async function shareFileOnAndroid(file: ExportFileDelivery) {
  const canShare = await Share.canShare();

  if (!canShare.value) {
    return false;
  }

  const savedFile = await Filesystem.writeFile({
    path: file.fileName,
    data: file.content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  try {
    await Share.share({
      title: file.title ?? file.fileName,
      text: file.title ?? file.fileName,
      files: [savedFile.uri],
      dialogTitle: file.title ?? file.fileName,
    });
  } finally {
    try {
      await Filesystem.deleteFile({
        path: file.fileName,
        directory: Directory.Cache,
      });
    } catch (error) {
      warnSafely('Unable to delete temporary export file.', error);
    }
  }

  return true;
}

export async function shareExportFile(file: ExportFileDelivery) {
  if (Capacitor.getPlatform() === 'android') {
    return shareFileOnAndroid(file);
  }

  // TODO(iOS): Verify Filesystem cache + Share behavior on a real iOS device
  // before enabling the native branch for iOS.
  return shareFileInBrowser(file);
}

export async function saveOrShareExportFile(file: ExportFileDelivery) {
  const didShare = await shareExportFile(file);

  if (didShare) {
    return 'shared' as const;
  }

  downloadFileInBrowser(file);
  return 'downloaded' as const;
}
