package com.ug.phyfi_router.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import android.util.Log

/**
 * Gerencia o hardware de microfone, operando em taxa de amostragem padrão de áudio digital (44.1kHz).
 * Garante que a thread de captura rode com prioridade de áudio (URGENT_AUDIO) do Linux Kernel.
 */
class AudioCaptureManager(
    private val onAudioDataReceived: (ShortArray) -> Unit
) {
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var captureThread: Thread? = null

    // 44100Hz é o padrão universal que engloba a faixa que precisamos (1kHz - 4kHz)
    private val sampleRate = 44100
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    
    private val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

    @SuppressLint("MissingPermission") // Permissão já garantida pelo PermissionManager
    fun startCapture() {
        if (isRecording) return

        if (minBufferSize == AudioRecord.ERROR_BAD_VALUE || minBufferSize == AudioRecord.ERROR) {
            Log.e("AudioCapture", "Configuração de áudio não suportada pelo hardware.")
            return
        }

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            audioFormat,
            minBufferSize * 2 // Buffer duplo para evitar underflow
        )

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e("AudioCapture", "Falha ao inicializar o AudioRecord.")
            return
        }

        isRecording = true
        audioRecord?.startRecording()

        captureThread = Thread {
            // Eleva a prioridade da thread a nível de SO para evitar interrupções do Scheduler
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
            readAudioLoop()
        }.apply {
            name = "PhyFi-AudioCaptureThread"
            start()
        }
    }

    private fun readAudioLoop() {
        // Buffer dimensionado para blocos rápidos (reduz latência física de captura)
        val buffer = ShortArray(minBufferSize)

        while (isRecording && !Thread.currentThread().isInterrupted) {
            val readResult = audioRecord?.read(buffer, 0, buffer.size) ?: 0
            if (readResult > 0) {
                // Passa a cópia do array preenchido para não sofrer mutação durante a FFT
                onAudioDataReceived(buffer.copyOf(readResult))
            }
        }
    }

    fun stopCapture() {
        isRecording = false
        captureThread?.interrupt()
        captureThread = null
        
        audioRecord?.apply {
            if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                stop()
            }
            release()
        }
        audioRecord = null
    }
}