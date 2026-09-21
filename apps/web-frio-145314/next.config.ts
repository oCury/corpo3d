import type { NextConfig } from 'next';

const config: NextConfig = {
  // O Next 16 gera AGENTS.md/CLAUDE.md dentro de apps/web; as regras do projeto
  // vivem na raiz, então desligamos a geração para não duplicar instrução.
  agentRules: false,
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // o manifesto muda a cada build do pipeline; a regra posterior sobrepõe a anterior para o mesmo header
        source: '/models/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default config;
