import React, { useState } from 'react';
import {
  PHONEME_DICTIONARY,
  HEADER_PHONEME,
  TAIL_PHONEME,
  PhonemeSpec,
} from '../protocol/phyfiProtocol';
import { SoFiAcousticModem } from '../protocol/sofiAcousticModem';
import { Volume2, Upload, CheckCircle2, Play, Radio } from 'lucide-react';

interface PhonemeSoundbankModalProps {
  isOpen: boolean;
  onClose: () => void;
  modem: SoFiAcousticModem;
}

export const PhonemeSoundbankModal: React.FC<PhonemeSoundbankModalProps> = ({
  isOpen,
  onClose,
  modem,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState<number>(modem.getCustomLoadedCount());
  const [statusMsg, setStatusMsg] = useState<string>('');

  if (!isOpen) return null;

  const allSpecs: PhonemeSpec[] = [HEADER_PHONEME, ...PHONEME_DICTIONARY, TAIL_PHONEME];

  const handlePreviewPhoneme = (spec: PhonemeSpec) => {
    setPlayingId(spec.id);
    const ctx = modem.ensureContext();
    modem.triggerPhonemeAt(spec, ctx.currentTime + 0.01, 0.14);
    window.setTimeout(() => setPlayingId(null), 160);
  };

  const handlePlayDemoSequence = () => {
    setStatusMsg('Emitindo pacote de teste 16-bits: [header -> p1 -> pA -> p0 -> p9 -> tail]...');
    modem.transmitPacketAcoustically(1, 10, 0x09, false);
    window.setTimeout(() => setStatusMsg(''), 1400);
  };

  const handleFileUpload = async (specId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await modem.loadCustomPhonemeFile(specId, file);
    if (ok) {
      setUploadCount(modem.getCustomLoadedCount());
      setStatusMsg(`Arquivo ${file.name} vinculado ao fonema ${specId}.ogg com sucesso.`);
    } else {
      setStatusMsg(`Erro ao decodificar ${file.name}. Use formato .ogg, .wav ou .mp3.`);
    }
  };

  const handleBatchFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    let loaded = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const baseName = f.name.replace(/\.(ogg|wav|mp3)$/i, '').toLowerCase();
      const matched = allSpecs.find((s) => s.id.toLowerCase() === baseName);
      if (matched) {
        const ok = await modem.loadCustomPhonemeFile(matched.id, f);
        if (ok) loaded++;
      }
    }
    setUploadCount(modem.getCustomLoadedCount());
    setStatusMsg(`${loaded} arquivo(s) de fonema carregados no Soundbank Hexadecimal.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundbank-modal-title"
    >
      <div className="w-full max-w-4xl border border-slate-800 bg-[#0B0E17] text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="soundbank-modal-title" className="font-display text-lg font-bold tracking-wide text-white">
              Dicionário de Áudio Hexadecimal So-Fi (16 Fonemas + Header/Tail)
            </h2>
            <p className="text-xs text-slate-400">
              Zona de Ouro Psicoacústica (1100 Hz – 3350 Hz) · Síntese Combinatória Formante F1/F2 Ativa ou Upload de{' '}
              <code className="text-cyan-400">/phonemes/*.ogg</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            Fechar Dicionário
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 bg-[#07090E] px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePlayDemoSequence}
              className="flex items-center gap-2 border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 whitespace-nowrap"
            >
              <Radio className="h-3.5 w-3.5" />
              Testar Sequência Combinatória 16-Bits
            </button>

            <label className="flex cursor-pointer items-center gap-2 border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap">
              <Upload className="h-3.5 w-3.5 text-amber-400" />
              Carregar Múltiplos (header.ogg, p0..p15.ogg, tail.ogg)
              <input
                type="file"
                multiple
                accept=".ogg,.wav,.mp3,audio/*"
                onChange={handleBatchFolderUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="font-mono text-xs text-slate-400">
            Arquivos Customizados: <span className="text-cyan-400 font-semibold">{uploadCount}/18</span> · Síntese Vocal Nativa: <span className="text-emerald-400">18/18 Prontos</span>
          </div>
        </div>

        {statusMsg && (
          <div className="border-b border-cyan-900/50 bg-cyan-950/30 px-6 py-2 font-mono text-xs text-cyan-300">
            {statusMsg}
          </div>
        )}

        {/* Phoneme Grid */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {allSpecs.map((spec) => {
              const isCustom = modem.hasCustomPhoneme(spec.id);
              const isPlaying = playingId === spec.id;
              const hexLabel =
                spec.id === 'header'
                  ? 'SYNC'
                  : spec.id === 'tail'
                  ? 'EOT'
                  : `0x${spec.index.toString(16).toUpperCase()}`;

              return (
                <div
                  key={spec.id}
                  className={`flex items-center justify-between border p-3 transition-colors ${
                    isPlaying
                      ? 'border-cyan-400 bg-cyan-950/30'
                      : 'border-slate-800 bg-[#111827]/70 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-cyan-400">{spec.id}.ogg</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-amber-400 font-semibold">{hexLabel}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">{spec.ipa}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-400">
                      Carrier: <span className="text-slate-200">{spec.fundamentalHz} Hz</span> · F2:{' '}
                      <span className="text-slate-300">{spec.formantF2Hz} Hz</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{spec.description}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewPhoneme(spec)}
                      aria-label={`Ouvir fonema ${spec.id}`}
                      className="flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500 hover:text-cyan-300"
                    >
                      {isPlaying ? <Volume2 className="h-3.5 w-3.5 text-cyan-400" /> : <Play className="h-3.5 w-3.5" />}
                    </button>

                    <label
                      title={`Enviar arquivo ${spec.id}.ogg customizado`}
                      className={`flex h-8 w-8 cursor-pointer items-center justify-center border ${
                        isCustom
                          ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-400'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                      }`}
                    >
                      {isCustom ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                      <input
                        type="file"
                        accept=".ogg,.wav,.mp3,audio/*"
                        onChange={(e) => handleFileUpload(spec.id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
