import { describe, it, expect, vi } from 'vitest';
import { MeshPhysicalMaterial } from 'three';
import { materialPara, corPorNome } from './index';

describe('materialPara', () => {
  it('não passa sheenColor undefined ao three (que avisa no console)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    materialPara('esqueleto', 'Femur');
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('sheenColor'))).toEqual([]);
    warn.mockRestore();
  });
  it('reusa o material por sistema+cor', () => {
    expect(materialPara('esqueleto', 'Femur')).toBe(materialPara('esqueleto', 'Tibia'));
    expect(materialPara('cardiovascular', 'Vena cava')).not.toBe(materialPara('cardiovascular', 'Aorta'));
  });
  it('a pele recebe o shader procedural (onBeforeCompile definido) e os demais não', () => {
    expect(materialPara('pele', 'Cutis').onBeforeCompile).not.toBe(MeshPhysicalMaterial.prototype.onBeforeCompile);
    expect(materialPara('esqueleto', 'Femur').onBeforeCompile).toBe(MeshPhysicalMaterial.prototype.onBeforeCompile);
    expect(materialPara('pele', 'Cutis').customProgramCacheKey()).toBe('pele-procedural-v2');
  });
  it('colore veias de azul e artérias de vermelho pelo nome em latim', () => {
    expect(corPorNome('cardiovascular', 'Vena cava superior')).toBe('#3f5fa8');
    expect(corPorNome('cardiovascular', 'Arteria femoralis')).toBe('#c4322d');
    expect(corPorNome('cardiovascular', 'Cor')).toBe('#b3312e');
  });
});
