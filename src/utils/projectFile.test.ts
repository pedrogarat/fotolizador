import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { readFotFile } from './projectFile';

describe('projectFile (.fot)', () => {
  it('parses a valid .fot project JSON with settings and photos', async () => {
    const rawFot = JSON.stringify({
      format: 'fotoprint',
      version: 1,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      settings: {
        ...DEFAULT_SETTINGS,
        mainTitle: 'PROYECTO DE EDIFICACIÓN',
        title: 'Inspección Estructura A',
        columns: 3,
        rows: 2,
      },
      photos: [
        {
          name: 'foto1.jpg',
          manualOrder: 0,
          rotation: 90,
          customCaption: 'Fisura en pilar 3',
        },
        {
          name: 'foto2.jpg',
          manualOrder: 1,
          rotation: 0,
          customCaption: 'Vista general',
        },
      ],
    });

    const file = new File([rawFot], 'proyecto.fot', { type: 'application/json' });
    const result = await readFotFile(file);

    expect(result.format).toBe('fotoprint');
    expect(result.settings.mainTitle).toBe('PROYECTO DE EDIFICACIÓN');
    expect(result.settings.title).toBe('Inspección Estructura A');
    expect(result.settings.columns).toBe(3);
    expect(result.photos).toHaveLength(2);
    expect(result.photos[0].name).toBe('foto1.jpg');
    expect(result.photos[0].rotation).toBe(90);
    expect(result.photos[0].customCaption).toBe('Fisura en pilar 3');
  });

  it('rejects invalid JSON content with a friendly error', async () => {
    const file = new File(['texto no valido corrupto'], 'error.fot', { type: 'application/json' });
    await expect(readFotFile(file)).rejects.toThrow(/formato válido/i);
  });
});
