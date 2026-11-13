import { describe, expect, it } from 'vitest';
import { isPhotoMatch, normalizePath } from './fileSystemUtils';

describe('fileSystemUtils', () => {
  it('normalizes path separators and casing', () => {
    expect(normalizePath('02_VISITAS DE OBRA\\2026_03_11_R\\foto.jpg')).toBe(
      '02_visitas de obra/2026_03_11_r/foto.jpg'
    );
  });

  it('matches photo when relative path matches subpath', () => {
    const config = {
      name: 'IMG_01.jpg',
      relativePath: '2026_03_11_R/IMG_01.jpg',
    };

    const file = new File([''], 'IMG_01.jpg');
    Object.defineProperty(file, 'webkitRelativePath', {
      value: '02_VISITAS DE OBRA/2026_03_11_R/IMG_01.jpg',
    });

    expect(isPhotoMatch(config, file)).toBe(true);
  });

  it('matches photo by filename as fallback', () => {
    const config = {
      name: 'Estado Aljibe 1.jpg',
    };

    const file = new File([''], 'estado aljibe 1.jpg');
    expect(isPhotoMatch(config, file)).toBe(true);
  });
});

