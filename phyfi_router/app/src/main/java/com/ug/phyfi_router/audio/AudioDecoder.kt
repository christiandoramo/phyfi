package com.ug.phyfi_router.audio

import be.tarsos.dsp.util.fft.FFT
import be.tarsos.dsp.util.fft.HannWindow
import kotlin.math.abs

/**
 * Responsável pela extração esteganográfica baseada em Dicionário Hexadecimal.
 * Filtra frequências vocais (1kHz-4kHz), rejeita ruído e reconstrói pacotes de 16-bits.
 */
class AudioDecoder(
    private val sampleRate: Float = 44100f,
    private val onPayloadDecoded: (Short) -> Unit
) {
    // Janela de FFT (Potência de 2 estrita). 2048 samples a 44.1kHz gera latência física de ~46ms.
    private val fftSize = 2048
    private val fft = FFT(fftSize, HannWindow())
    private val floatBuffer = FloatArray(fftSize)
    private val amplitudes = FloatArray(fftSize / 2)

    private val bufferQueue = mutableListOf<Short>()

    // Dicionário de Frequências (0x0 a 0xF) espalhadas na zona de ouro psicoacústica (1kHz a ~3.4kHz).
    // Estes valores devem casar perfeitamente com os "Soundbanks" do script Haxe na engine.
    private val frequencyBins = floatArrayOf(
        1100f, 1250f, 1400f, 1550f, 1700f, 1850f, 2000f, 2150f,
        2300f, 2450f, 2600f, 2750f, 2900f, 3050f, 3200f, 3350f
    )

    // Acumulador: são necessários 4 "bips" hexadecimais (4 bits cada) para formar o pacote Kine-Fi de 16-bits
    private val hexBuffer = ByteArray(4)
    private var hexIndex = 0

    fun processAudio(shortBuffer: ShortArray) {
        bufferQueue.addAll(shortBuffer.toList())

        // Processa todos os chunks disponíveis que atingiram a potência de 2
        while (bufferQueue.size >= fftSize) {
            val chunk = bufferQueue.take(fftSize)
            bufferQueue.subList(0, fftSize).clear()
            executeFFT(chunk)
        }
    }

    private fun executeFFT(chunk: List<Short>) {
        // O algoritmo TarsosDSP exige float normalizado entre -1.0 e 1.0
        for (i in chunk.indices) {
            floatBuffer[i] = chunk[i] / 32768f
        }

        fft.forwardTransform(floatBuffer)
        fft.modulus(floatBuffer, amplitudes)

        var maxAmp = 0f
        var targetFreq = 0f

        // Varredura para encontrar a frequência dominante
        for (i in amplitudes.indices) {
            val currentFreq = (i * sampleRate) / fftSize
            
            // Bypass físico: Analisa apenas a faixa alvo. Ignora graves (passos, motor) e agudos descartados.
            if (currentFreq in 1000f..4000f) {
                if (amplitudes[i] > maxAmp) {
                    maxAmp = amplitudes[i]
                    targetFreq = currentFreq
                }
            }
        }

        // Noise Gate matemático: Ignora ruídos ambientes normais. (Limiar exigirá fine-tuning em testes físicos)
        if (maxAmp > 0.05f) {
            mapFrequencyToHex(targetFreq)?.let { hexValue ->
                accumulateHex(hexValue)
            }
        }
    }

    private fun mapFrequencyToHex(freq: Float): Byte? {
        val tolerance = 60f // Margem de erro em Hz devido à compressão de áudio
        for (i in frequencyBins.indices) {
            if (abs(freq - frequencyBins[i]) <= tolerance) {
                return i.toByte()
            }
        }
        return null
    }

    private fun accumulateHex(hexValue: Byte) {
        hexBuffer[hexIndex] = hexValue
        hexIndex++

        if (hexIndex == 4) {
            val payload = buildShortFromHex()
            onPayloadDecoded(payload)
            hexIndex = 0
        }
    }

    private fun buildShortFromHex(): Short {
        val h1 = (hexBuffer[0].toInt() and 0x0F) shl 12
        val h2 = (hexBuffer[1].toInt() and 0x0F) shl 8
        val h3 = (hexBuffer[2].toInt() and 0x0F) shl 4
        val h4 = hexBuffer[3].toInt() and 0x0F
        return (h1 or h2 or h3 or h4).toShort()
    }
}