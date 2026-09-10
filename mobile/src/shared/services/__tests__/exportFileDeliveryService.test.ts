import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  canShare: vi.fn(),
  share: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  warnSafely: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    getPlatform: vi.fn(),
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'UTF8' },
  Filesystem: {
    writeFile: mocks.writeFile,
    deleteFile: mocks.deleteFile,
  },
}));
vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: mocks.canShare,
    share: mocks.share,
  },
}));
vi.mock('@/shared/services/safeLogService', () => ({
  warnSafely: mocks.warnSafely,
}));

import { deliverBinaryExportFile } from '../exportFileDeliveryService';

describe('deliverBinaryExportFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.canShare.mockResolvedValue({ value: true });
    mocks.writeFile.mockResolvedValue({ uri: 'file://cache/weekly.pdf' });
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.share.mockResolvedValue(undefined);
  });

  it('writes PDF bytes as base64, shares, and removes the cache file', async () => {
    const result = await deliverBinaryExportFile({
      content: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      fileName: 'weekly.pdf',
      mimeType: 'application/pdf',
    });

    expect(result).toBe('shared');
    expect(mocks.writeFile).toHaveBeenCalledWith({
      path: 'weekly.pdf',
      data: 'JVBERi0xLjc=',
      directory: 'CACHE',
      recursive: true,
    });
    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['file://cache/weekly.pdf'],
      })
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: 'weekly.pdf',
      directory: 'CACHE',
    });
  });

  it('fails before writing a file when native sharing is unavailable', async () => {
    mocks.canShare.mockResolvedValue({ value: false });

    await expect(
      deliverBinaryExportFile({
        content: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
        fileName: 'weekly.pdf',
        mimeType: 'application/pdf',
      })
    ).rejects.toThrow('Native file sharing is unavailable.');

    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
