import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extrairObjs, sha256DoArquivo, precisaBaixar } from '../src/baixar';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FIXTURE_MINI_ZIP = join(AQUI, 'fixtures', 'mini.zip');

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

  it('extrai só os .obj do prefixo esperado, ignorando os demais arquivos do zip', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'bp3d-extrai-'));
    const total = await extrairObjs(FIXTURE_MINI_ZIP, destino);
    expect(total).toBe(2);
    expect(readdirSync(destino).sort()).toEqual(['FJ1.obj', 'FJ2M.obj']);
    expect(readFileSync(join(destino, 'FJ1.obj'), 'utf8')).toBe('v 0 0 0\n');
  });

  it('rejeita quando o caminho do zip não existe', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'bp3d-extrai-erro-'));
    await expect(
      extrairObjs(join(AQUI, 'fixtures', 'nao-existe.zip'), destino),
    ).rejects.toThrow();
  });
});
