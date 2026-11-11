import React from 'react';
import { Terminal, BookOpen, Cpu, Smartphone, Monitor, ShieldAlert } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-modal-title"
    >
      <div className="w-full max-w-4xl border border-slate-800 bg-[#0B0E17] text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="docs-modal-title" className="font-display text-lg font-bold tracking-wide text-white">
                Manual de Operação Phy-Fi (README — Guia Jogador 1 & Jogador 2)
              </h2>
              <p className="text-xs text-slate-400">
                Topologia Encapsulated Edge Input Swarm (EEIS) · So-Fi Acústico + Kine-Fi Bluetooth HID + WebRTC P2P
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            Fechar Manual
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 text-sm leading-relaxed text-slate-300">
          {/* Overview */}
          <section className="space-y-2 border border-slate-800 bg-[#111827]/60 p-4">
            <h3 className="font-display text-base font-bold text-white">
              01. Arquitetura do Novo Meio de Protocolo de Rede (Phy-Fi 16-Bits)
            </h3>
            <p className="text-xs text-slate-300">
              O protocolo <strong>Phy-Fi (Physical-Fidelity)</strong> cria uma malha de comunicação P2P entre máquinas
              diferentes convertendo cada smartphone em um modem acústico e mecânico em tempo real:
            </p>
            <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3 text-xs">
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-mono font-semibold text-cyan-400">1. DOWNLINK SO-FI (Acústico)</div>
                <p className="mt-1 text-slate-400">
                  O PC codifica cada ação em um pacote de <strong>16 bits</strong> (4 bits Ator + 4 bits Timestamp + 8 bits Intenção WASD)
                  e toca uma sequência sobreposta de 6 fonemas (<code className="text-slate-200">header.ogg</code>, 4 nibbles{' '}
                  <code className="text-slate-200">p0..p15.ogg</code> na faixa de 1.1 kHz a 3.35 kHz + <code className="text-slate-200">tail.ogg</code>).
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-mono font-semibold text-amber-400">2. MALHA WEBRTC P2P (PIN)</div>
                <p className="mt-1 text-slate-400">
                  O celular escuta pelo microfone sempre ativo (mesmo em 2º plano via WakeLock + Foreground Service),
                  executa a FFT de 2048 amostras com Noise Gate seletivo e envia os 2 bytes via DataChannel UDP (ordered=false)
                  ao celular do outro jogador.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-mono font-semibold text-emerald-400">3. UPLINK KINE-FI (Bluetooth HID)</div>
                <p className="mt-1 text-slate-400">
                  O celular receptor traduz o pacote 16-bits em relatórios mecânicos de teclado Bluetooth HID usando o Chord Obscuro{' '}
                  <code className="text-slate-200">LCtrl (0x01) + F15 (0x6A) + Intent</code> com jitter anatômico (5–22ms) atualizando a Arena 2D.
                </p>
              </div>
            </div>
          </section>

          {/* Step by step per device */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className="border border-slate-800 bg-[#111827]/60 p-4">
              <div className="flex items-center gap-2 font-display text-sm font-bold text-cyan-400">
                <Monitor className="h-4 w-4" />
                <span>O Que o JOGADOR 1 (Host) Deve Fazer</span>
              </div>
              <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
                <li>
                  <strong>No PC 1 (Máquina Host):</strong> Abra este aplicativo no navegador, selecione{' '}
                  <strong>Jogador 1 (Host)</strong> e clique em <strong>Criar Sala Phy-Fi (Gerar PIN)</strong>. Um PIN de 6 dígitos será exibido.
                </li>
                <li>
                  <strong>No Celular 1 (Roteador Físico 1):</strong> Pareie o celular via Bluetooth com o PC 1 (perfil HID Keyboard)
                  ou abra esta mesma URL no navegador do Celular 1 na aba <strong>Modo Roteador Mobile</strong>.
                </li>
                <li>
                  Digite o mesmo <strong>PIN de 6 dígitos</strong> no Celular 1 e ative o <strong>Microfone FFT So-Fi</strong>.
                  Posicione o celular próximo à saída de som do PC 1.
                </li>
                <li>
                  Pressione <strong>WASD</strong> (ou <strong>Espaço</strong> para Dash / <strong>E</strong> para Pulso) no PC 1:
                  o PC emitirá a rajada combinatória de fonemas humanos e atualizará a Arena 2D determinística.
                </li>
              </ol>
            </section>

            <section className="border border-slate-800 bg-[#111827]/60 p-4">
              <div className="flex items-center gap-2 font-display text-sm font-bold text-amber-400">
                <Smartphone className="h-4 w-4" />
                <span>O Que o JOGADOR 2 (Client) Deve Fazer</span>
              </div>
              <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
                <li>
                  <strong>No PC 2 (Máquina Client):</strong> Abra este aplicativo em outra máquina (ou outra aba/janela para teste rápido),
                  selecione <strong>Jogador 2 (Client)</strong> e digite o <strong>PIN de 6 dígitos</strong> gerado pelo Jogador 1.
                </li>
                <li>
                  <strong>No Celular 2 (Roteador Físico 2):</strong> Pareie o Celular 2 como Teclado Bluetooth HID no PC 2 e insira o mesmo
                  PIN de 6 dígitos no app Roteador Mobile.
                </li>
                <li>
                  Assim que o túnel WebRTC/Signaler indicar <strong>CONECTADO</strong>, pressione <strong>WASD</strong> (ou Setas)
                  no PC 2. Os pacotes de 16 bits cruzarão o link acústico/P2P e injetarão os comandos Kine-Fi em tempo real!
                </li>
                <li>
                  <strong>Encerramento Automático:</strong> Ao clicar em <strong>Encerrar Sessão (FIN)</strong> ou fechar a aba,
                  o pacote <code className="text-rose-400">0xF080 (FIN_CLOSE)</code> desfaz o túnel WebRTC, libera o microfone e zera a sala.
                </li>
              </ol>
            </section>
          </div>

          {/* Local & Native Commands */}
          <section className="space-y-2 border border-slate-800 bg-[#111827]/60 p-4">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-white">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span>Como Rodar Localmente & Compilar o APK Android Nativo</span>
            </div>
            <pre className="overflow-x-auto border border-slate-800 bg-[#07090E] p-3 font-mono text-xs text-slate-300">
{`# 1. Instalar dependências e iniciar Servidor Web + Signaler WebRTC (Porta 3000)
npm install
npm run dev

# 2. Rodar Testes Unitários Determinísticos (Protocolo 16-Bit, FFT, Kine-Fi HID e Física 2D)
npx --yes tsx --test src/protocol/phyfiProtocol.test.ts

# 3. (Opcional) Compilar o APK Android Nativo (phyfi_router)
cd phyfi_router && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
};
