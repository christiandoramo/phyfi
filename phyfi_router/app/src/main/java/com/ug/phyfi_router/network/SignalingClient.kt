package com.ug.phyfi_router.network

import android.util.Log
import java.net.URI
import javax.net.ssl.SSLSocketFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONObject

class SignalingClient(
        private val roomId: String,
        private val onStatus: (String) -> Unit,
        private val onMessageReceived: (JSONObject) -> Unit
) {
    private var webSocket: WebSocketClient? = null
    private val serverUrl = "wss://ug-signaler.onrender.com"

    private var isIntentionalDisconnect = false
    private val clientScope = CoroutineScope(Dispatchers.IO)

    fun connect() {
        isIntentionalDisconnect = false
        val uri = URI(serverUrl)

        webSocket =
                object : WebSocketClient(uri) {
                    override fun onOpen(handshakedata: ServerHandshake?) {
                        onStatus("Signaler: Conectado. Sala: $roomId")
                        joinRoom()
                    }

                    override fun onMessage(message: String?) {
                        if (message == null) return
                        try {
                            val json = JSONObject(message)
                            onMessageReceived(json)
                        } catch (e: Exception) {
                            Log.e("SignalingClient", "Falha no Parse JSON: $message")
                        }
                    }

                    override fun onClose(code: Int, reason: String?, remote: Boolean) {
                        if (!isIntentionalDisconnect) {
                            onStatus("Signaler Derrubado pelo SO ($code). Reconectando...")
                            attemptReconnect()
                        } else {
                            onStatus("Signaler: Sessão encerrada.")
                        }
                    }

                    override fun onError(ex: Exception?) {
                        Log.e("SignalingClient", "Erro WebSocket", ex)
                    }
                }

        if (uri.scheme.equals("wss", ignoreCase = true)) {
            try {
                val factory = SSLSocketFactory.getDefault() as SSLSocketFactory
                webSocket?.setSocketFactory(factory)
            } catch (e: Exception) {
                onStatus("Signaler Erro: Falha ao estabelecer SSL")
            }
        }

        webSocket?.connect()
    }

    private fun attemptReconnect() {
        clientScope.launch {
            delay(3000) // Backoff estático de 3 segundos
            if (!isIntentionalDisconnect) {
                connect()
            }
        }
    }

    private fun joinRoom() {
        val payload = JSONObject()
        payload.put("type", "join")
        send(payload)
    }

    fun send(payload: JSONObject) {
        payload.put("room", roomId)
        if (webSocket?.isOpen == true) {
            webSocket?.send(payload.toString())
        }
    }

    fun disconnect() {
        isIntentionalDisconnect = true
        webSocket?.close()
    }
}
