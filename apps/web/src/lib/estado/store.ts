import { create } from 'zustand';
import { carregarManifestoPartes, type Manifesto, type PecaManifesto, type Sistema } from '@/lib/manifesto';
import { EstadoCenaSchema, ESTADO_INICIAL, MAX_HISTORICO, MAX_NOTA, type EstadoCena, CORES_DESTAQUE } from './schema';
import { enquadrar } from './geometria';
import type { PartesCarregadas } from './detalhe';

export type CorDestaque = (typeof CORES_DESTAQUE)[number];
export type Vec3 = [number, number, number];
export type PresetCamera = 'frente' | 'costas' | 'esquerda' | 'direita' | 'superior' | 'livre';

interface Loja {
  // serializável (vai no link)
  estado: EstadoCena;
  historico: EstadoCena[];
  futuro: EstadoCena[];
  // transitório (não vai no link)
  manifesto: Manifesto | null;
  erroManifesto: string | null;
  selecionada: string | null;
  hover: string | null;
  arrastando: string | null;
  presetCamera: PresetCamera;
  partes: PartesCarregadas;
  // genéricas
  reiniciar(): void;
  definirManifesto(m: Manifesto): void;
  definirErroManifesto(m: string | null): void;
  aplicar(parcial: Partial<EstadoCena>, op?: { historico?: boolean }): void;
  /** Empilha `anterior` no histórico (uma entrada por gesto de slider), se o estado mudou desde ele. */
  registrarSnapshot(anterior: EstadoCena): void;
  desfazer(): void;
  refazer(): void;
  selecionar(fmaId: string | null): void;
  passarMouse(fmaId: string | null): void;
  definirArrastando(fmaId: string | null): void;
  definirPreset(p: PresetCamera): void;
  // domínio
  definirOpacidade(sistema: Sistema, valor: number, op?: { historico?: boolean }): void;
  alternarOculta(fmaId: string): void;
  soltar(fmaId: string, pos: Vec3): void;
  encaixar(fmaId: string): void;
  remontarTudo(): void;
  definirExplosao(valor: number, op?: { historico?: boolean }): void;
  isolar(fmaId: string | null): void;
  destacar(fmaId: string, cor: CorDestaque | null): void;
  anotar(fmaId: string, texto: string): void;
  definirCamera(pos: Vec3, alvo: Vec3): void;
  /** Busca `/models/partes/<pai>.json` uma vez; guarda a lista, ou 'erro'. */
  carregarPartes(paiFmaId: string): Promise<void>;
  /** Carrega antes de abrir; se falhar, não muda o estado e devolve false. Encaixa o nó, empilha, tira a seleção, enquadra. */
  abrirPartes(peca: PecaManifesto): Promise<boolean>;
  /** Mantém os primeiros `nivel` itens da pilha (0 fecha tudo). */
  fecharPartes(nivel: number): void;
}

export const useLoja = create<Loja>()((set, get) => ({
  estado: ESTADO_INICIAL, historico: [], futuro: [],
  manifesto: null, erroManifesto: null, selecionada: null, hover: null, arrastando: null, presetCamera: 'frente', partes: {},

  reiniciar: () => set({ estado: ESTADO_INICIAL, historico: [], futuro: [], erroManifesto: null, selecionada: null, hover: null, arrastando: null, presetCamera: 'frente', partes: {} }),
  definirManifesto: (manifesto) => set({ manifesto }),
  definirErroManifesto: (erroManifesto) => set({ erroManifesto }),
  registrarSnapshot: (anterior) => {
    const { estado, historico } = get();
    if (anterior === estado) return;
    set({ historico: [...historico, anterior].slice(-MAX_HISTORICO), futuro: [] });
  },

  aplicar: (parcial, op) => {
    const { estado, historico } = get();
    const novo = EstadoCenaSchema.parse({ ...estado, ...parcial }); // valida: lança se inválido
    if (op?.historico === false) return set({ estado: novo });
    set({ estado: novo, historico: [...historico, estado].slice(-MAX_HISTORICO), futuro: [] });
  },
  desfazer: () => {
    const { estado, historico, futuro } = get();
    if (!historico.length) return;
    set({ estado: historico[historico.length - 1], historico: historico.slice(0, -1), futuro: [estado, ...futuro] });
  },
  refazer: () => {
    const { estado, historico, futuro } = get();
    if (!futuro.length) return;
    set({ estado: futuro[0], futuro: futuro.slice(1), historico: [...historico, estado].slice(-MAX_HISTORICO) });
  },
  selecionar: (selecionada) => set({ selecionada }),
  passarMouse: (hover) => set({ hover }),
  definirArrastando: (arrastando) => set({ arrastando }),
  definirPreset: (presetCamera) => set({ presetCamera }),

  definirOpacidade: (sistema, valor, op) => get().aplicar({ opacidade: { ...get().estado.opacidade, [sistema]: valor } }, op),
  alternarOculta: (fmaId) => {
    const { ocultas } = get().estado;
    get().aplicar({ ocultas: ocultas.includes(fmaId) ? ocultas.filter((i) => i !== fmaId) : [...ocultas, fmaId] });
  },
  soltar: (fmaId, pos) => get().aplicar({ soltas: [...get().estado.soltas.filter((s) => s.fmaId !== fmaId), { fmaId, pos }] }),
  encaixar: (fmaId) => get().aplicar({ soltas: get().estado.soltas.filter((s) => s.fmaId !== fmaId) }),
  remontarTudo: () => get().aplicar({ soltas: [], explosao: 0 }),
  definirExplosao: (explosao, op) => get().aplicar({ explosao }, op),
  isolar: (isolada) => get().aplicar({ isolada }),
  destacar: (fmaId, cor) => {
    const resto = get().estado.destacadas.filter((d) => d.fmaId !== fmaId);
    get().aplicar({ destacadas: cor ? [...resto, { fmaId, cor }] : resto });
  },
  anotar: (fmaId, texto) => {
    const resto = get().estado.notas.filter((n) => n.fmaId !== fmaId);
    const t = texto.trim().slice(0, MAX_NOTA);
    get().aplicar({ notas: t ? [...resto, { fmaId, texto: t }] : resto });
  },
  definirCamera: (pos, alvo) => get().aplicar({ camera: { pos, alvo } }, { historico: false }),

  carregarPartes: async (paiFmaId) => {
    if (get().partes[paiFmaId] !== undefined && get().partes[paiFmaId] !== 'erro') return;
    set({ partes: { ...get().partes, [paiFmaId]: 'carregando' } });
    try {
      const lista = await carregarManifestoPartes(paiFmaId);
      set({ partes: { ...get().partes, [paiFmaId]: lista } });
    } catch (e) {
      console.warn(`partes de ${paiFmaId}:`, (e as Error).message);
      set({ partes: { ...get().partes, [paiFmaId]: 'erro' } });
    }
  },
  abrirPartes: async (peca) => {
    await get().carregarPartes(peca.fmaId);
    if (!Array.isArray(get().partes[peca.fmaId])) return false;
    const e = get().estado;
    const q = enquadrar(peca);
    get().aplicar({ detalhe: [...e.detalhe, peca.fmaId], soltas: e.soltas.filter((s) => s.fmaId !== peca.fmaId), camera: { pos: q.pos, alvo: q.alvo } });
    set({ selecionada: null, presetCamera: 'livre' });
    return true;
  },
  fecharPartes: (nivel) => get().aplicar({ detalhe: get().estado.detalhe.slice(0, Math.max(0, nivel)) }),
}));

/** Seletores derivados, memoizáveis pelos componentes. */
export const corDestaqueDe = (e: EstadoCena, fmaId: string) => e.destacadas.find((d) => d.fmaId === fmaId)?.cor ?? null;
export const notaDe = (e: EstadoCena, fmaId: string) => e.notas.find((n) => n.fmaId === fmaId)?.texto ?? '';

/** Peça de nível 1 ou parte já carregada; null se não houver. */
export function pecaDe(s: { manifesto: Manifesto | null; partes: PartesCarregadas }, fmaId: string | null): PecaManifesto | null {
  if (!fmaId) return null;
  const p = s.manifesto?.pecas.find((x) => x.fmaId === fmaId);
  if (p) return p;
  for (const l of Object.values(s.partes)) {
    if (!Array.isArray(l)) continue;
    const q = l.find((x) => x.fmaId === fmaId);
    if (q) return q;
  }
  return null;
}
