package com.ug.phyfi_router.service

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.ug.phyfi_router.audio.AudioCaptureManager
import com.ug.phyfi_router.audio.AudioDecoder
import com.ug.phyfi_router.bluetooth.BluetoothHidManager
import com.ug.phyfi_router.bluetooth.KineFiTranslator
import com.ug.phyfi_router.core.RouterState
import com.ug.phyfi_router.network.SignalingClient
import com.ug.phyfi_router.network.WebRTCManager
import com.ug.phyfi_router.protocol.Protocol16Bit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PhyFiService : Service() {

    private lateinit var wakeLockManager: WakeLockManager
    private lateinit var foregroundNotifier: ForegroundNotifier

    private var signalingClient: SignalingClient? = null
    private var webRtcManager: WebRTCManager? = null
    private var audioCaptureManager: AudioCaptureManager? = null
    private var audioDecoder: AudioDecoder? = null
    private var bluetoothManager: BluetoothHidManager? = null
    private var kineFiTranslator: KineFiTranslator? = null

    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private var activePin: String? = null

    override fun onCreate() {
        super.onCreate()
        wakeLockManager = WakeLockManager(this).apply { acquire() }
        foregroundNotifier = ForegroundNotifier(this)

        try {
            val notification = foregroundNotifier.build(null)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                var serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    serviceType = serviceType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                }
                startForeground(foregroundNotifier.notificationId, notification, serviceType)
            } else {
                startForeground(foregroundNotifier.notificationId, notification)
            }
        } catch (e: Exception) {
            logAsync("ERRO CRÍTICO no Foreground: ${e.message}")
            shutdownService()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "STOP" -> {
                shutdownService()
                return START_NOT_STICKY
            }
            "INIT_HARDWARE" -> {
                if (bluetoothManager == null) initializeBluetoothStack()
            }
            "START_NETWORK" -> {
                val pin = intent.getStringExtra("ROOM_PIN")
                if (pin != null && activePin != pin) {
                    activePin = pin
                    initializeNetworkStack(pin)
                    initializeAudioStack()
                    foregroundNotifier.update(pin)
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        shutdownService()
        super.onTaskRemoved(rootIntent)
    }

    private fun initializeBluetoothStack() {
        bluetoothManager = BluetoothHidManager(applicationContext).apply { initialize() }
        kineFiTranslator = KineFiTranslator(bluetoothManager!!)
        logAsync("Kine-Fi ativado. Conecte o PC ao celular.")
    }

    private fun initializeNetworkStack(roomPin: String) {
        serviceScope.launch {
            try {
                // Alocação local garante imutabilidade para o compilador do Kotlin
                val currentSigClient =
                        SignalingClient(roomPin, { msg -> logAsync(msg) }) { jsonMessage ->
                            webRtcManager?.processSignalingMessage(jsonMessage)
                        }
                signalingClient = currentSigClient

                webRtcManager =
                        WebRTCManager(applicationContext, currentSigClient) { data ->
                            if (data.size >= 2) {
                                val high = data[0].toInt() and 0xFF
                                val low = data[1].toInt() and 0xFF
                                val payload = Protocol16Bit.unpack(((high shl 8) or low).toShort())
                                kineFiTranslator?.processIncomingPayload(payload)
                            }
                        }

                currentSigClient.connect()
                webRtcManager?.createLocalDataChannel()
            } catch (e: Exception) {
                logAsync("ERRO DE REDE: ${e.message}")
            }
        }
    }
    private fun initializeAudioStack() {
        audioDecoder =
                AudioDecoder(44100f) { payload ->
                    val networkPacket = ByteArray(2)
                    networkPacket[0] = (payload.toInt() shr 8).toByte()
                    networkPacket[1] = payload.toByte()
                    webRtcManager?.sendData(networkPacket)
                }

        audioCaptureManager = AudioCaptureManager { buffer -> audioDecoder?.processAudio(buffer) }
        audioCaptureManager?.startCapture()
        logAsync("So-Fi Acústico ativo. Aguardando Dicionário.")
    }

    private fun logAsync(msg: String) {
        serviceScope.launch { RouterState.log(msg) }
    }

    private fun shutdownService() {
        audioCaptureManager?.stopCapture()
        signalingClient?.disconnect()
        bluetoothManager?.shutdown()
        foregroundNotifier.release()
        wakeLockManager.release()

        sendBroadcast(Intent("com.ug.phyfi_router.SERVICE_STOPPED"))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION") stopForeground(true)
        }
        stopSelf()
    }
}
