import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { sha256DoArquivo, precisaBaixar } from '../src/baixar';

describe('baixar', () => {
  it('calcula o sha256 de um arquivo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    writeFileSync(f, 'corpo3d');
    const esperado = createHash('sha256').update('corpo3d').digest('hex');
    expect(await sha256DoArquivo(f)).toBe(esperado);
  });

  it('não precisa baixar quando o arquivo existe e o hash confere', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    writeFileSync(f, 'corpo3d');
    const hash = createHash('sha256').update('corpo3d').digest('hex');
    expect(await precisaBaixar(f, hash)).toBe(false);
  });

  it('precisa baixar quando o hash não confere ou o arquivo não existe', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    expect(await precisaBaixar(f, 'abc')).toBe(true);
    writeFileSync(f, 'outro conteudo');
    expect(await precisaBaixar(f, 'abc')).toBe(true);
  });
});
