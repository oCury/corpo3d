import { z } from 'zod';
import { SISTEMAS, type Sistema } from '@/lib/manifesto';

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
const FmaId = z.string().regex(/^FMA\d+$/);
export const CORES_DESTAQUE = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#c77dff'] as const;
export const MAX_NOTA = 280;
export const MAX_HISTORICO = 50;

export const EstadoCenaSchema = z.object({
  v: z.literal(1),
  opacidade: z.record(z.enum(SISTEMAS), z.number().min(0).max(1)), // exaustivo: os 12 sistemas
  ocultas: z.array(FmaId),
  soltas: z.array(z.object({ fmaId: FmaId, pos: Vec3 })),
  destacadas: z.array(z.object({ fmaId: FmaId, cor: z.enum(CORES_DESTAQUE) })),
  notas: z.array(z.object({ fmaId: FmaId, texto: z.string().max(MAX_NOTA) })),
  isolada: FmaId.nullable(),
  explosao: z.number().min(0).max(1),
  camera: z.object({ pos: Vec3, alvo: Vec3 }),
});
export type EstadoCena = z.infer<typeof EstadoCenaSchema>;

export const CAMERA_INICIAL = { pos: [0, 1.0, 2.6] as [number, number, number], alvo: [0, 0.85, 0] as [number, number, number] };

export const ESTADO_INICIAL: EstadoCena = {
  v: 1,
  opacidade: Object.fromEntries(SISTEMAS.map((s) => [s, 1])) as Record<Sistema, number>,
  ocultas: [],
  soltas: [],
  destacadas: [],
  notas: [],
  isolada: null,
  explosao: 0,
  camera: CAMERA_INICIAL,
};

export const serializar = (e: EstadoCena): string => JSON.stringify(EstadoCenaSchema.parse(e));

export function desserializar(texto: string): EstadoCena {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error('estado inválido: não é JSON');
  }
  const r = EstadoCenaSchema.safeParse(bruto);
  if (!r.success) throw new Error(`estado inválido: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}
