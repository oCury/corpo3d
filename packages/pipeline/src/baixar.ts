import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rename, rm, stat, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry } from 'yauzl';
import {
  ARQUIVOS_TEXTO,
  BASE_URL,
  DIR_CACHE,
  DIR_OBJ_NO_ZIP,
  TOTAL_OBJS_ESPERADOS,
  ZIP_NOME,
  ZIP_SHA256,
} from './constantes.js';

export async function sha256DoArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(caminho), async function* (src: AsyncIterable<Buffer>) {
    for await (const c of src) hash.update(c);
  });
  return hash.digest('hex');
}

export async function precisaBaixar(caminho: string, shaEsperado: string): Promise<boolean> {
  if (!existsSync(caminho)) return true;
  return (await sha256DoArquivo(caminho)) !== shaEsperado;
}

async function baixarArquivo(url: string, destino: string): Promise<void> {
  mkdirSync(dirname(destino), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`falha ao baixar ${url}: HTTP ${res.status}`);
  const tmp = `${destino}.part`;
  try {
    // `fetch` tipa `body` como `ReadableStream<Uint8Array>` do DOM; `fromWeb` espera o tipo do lib.dom.
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  } catch (erro) {
    await rm(tmp, { force: true });
    throw erro;
  }
  await rename(tmp, destino);
}

/** Extrai só os .obj do zip para `${DIR_CACHE}/obj/`, sem o prefixo do diretório interno. */
export async function extrairObjs(zip: string, destino: string): Promise<number> {
  await mkdir(destino, { recursive: true });
  return new Promise((resolvePromessa, reject) => {
    let n = 0;
    let falhou = false;

    const falhar = (erro: Error): void => {
      if (falhou) return;
      falhou = true;
      reject(erro);
    };

    // Só avança para a próxima entrada se ainda não falhamos — evita ler além
    // de um erro já rejeitado e evita rejeitar a Promise mais de uma vez.
    const proximaEntrada = (arquivo: yauzl.ZipFile): void => {
      if (falhou) return;
      arquivo.readEntry();
    };

    yauzl.open(zip, { lazyEntries: true }, (err, arquivo) => {
      if (err) return falhar(err);
      proximaEntrada(arquivo);
      arquivo.on('entry', (entrada: Entry) => {
        const nome = entrada.fileName;
        if (!nome.startsWith(`${DIR_OBJ_NO_ZIP}/`) || !nome.endsWith('.obj')) {
          proximaEntrada(arquivo);
          return;
        }
        const alvo = join(destino, nome.slice(DIR_OBJ_NO_ZIP.length + 1));
        arquivo.openReadStream(entrada, (e, stream) => {
          if (e) return falhar(e);
          stream.on('error', falhar);
          stream
            .pipe(createWriteStream(alvo))
            .on('finish', () => {
              n++;
              proximaEntrada(arquivo);
            })
            .on('error', falhar);
        });
      });
      arquivo.on('end', () => resolvePromessa(n));
      arquivo.on('error', falhar);
    });
  });
}

export async function baixarTudo(): Promise<void> {
  const zip = join(DIR_CACHE, ZIP_NOME);
  if (await precisaBaixar(zip, ZIP_SHA256)) {
    console.log(`baixando ${ZIP_NOME} (143 MB)…`);
    await baixarArquivo(`${BASE_URL}/${ZIP_NOME}`, zip);
    const sha = await sha256DoArquivo(zip);
    if (sha !== ZIP_SHA256) throw new Error(`SHA-256 do zip não confere: ${sha}`);
  } else {
    console.log(`${ZIP_NOME} já baixado e conferido`);
  }

  for (const nome of ARQUIVOS_TEXTO) {
    const destino = join(DIR_CACHE, nome);
    if (!existsSync(destino)) {
      console.log(`baixando ${nome}…`);
      await baixarArquivo(`${BASE_URL}/${nome}`, destino);
    }
  }

  const dirObj = join(DIR_CACHE, 'obj');
  const marcador = join(dirObj, 'FJ1252.obj');
  const jaExtraido = existsSync(marcador) && (await stat(marcador)).size > 0;
  if (!jaExtraido) {
    const n = await extrairObjs(zip, dirObj);
    console.log(`extraídos ${n} .obj`);
    if (n !== TOTAL_OBJS_ESPERADOS)
      throw new Error(`esperava ${TOTAL_OBJS_ESPERADOS} .obj, extraiu ${n}`);
  } else {
    console.log('objs já extraídos');
  }
}

if (process.argv[1] && process.argv[1].endsWith('baixar.ts')) {
  baixarTudo().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
