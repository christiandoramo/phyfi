package com.ug.phyfi_router.network

import android.content.Context
import android.util.Log
import com.ug.phyfi_router.core.RouterState
import org.json.JSONObject
import org.webrtc.*
import java.nio.ByteBuffer

class WebRTCManager(
    private val context: Context,
    private val signalingClient: SignalingClient,
    private val onDataReceived: (ByteArray) -> Unit
) {
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null

    init {
        initializeFactory()
        createPeerConnection()
    }

    private fun initializeFactory() {
        val initializationOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(initializationOptions)

        val options = PeerConnectionFactory.Options()
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(options)
            .createPeerConnectionFactory()
    }

    private fun createPeerConnection() {
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
        
        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                if (candidate == null) return
                val payload = JSONObject()
                payload.put("type", "candidate")
                payload.put("sdpMid", candidate.sdpMid)
                payload.put("sdpMLineIndex", candidate.sdpMLineIndex)
                payload.put("candidate", candidate.sdp)
                signalingClient.send(payload)
            }

            override fun onDataChannel(dc: DataChannel?) {
                Log.i("WebRTC", "DataChannel remoto estabelecido")
                setupDataChannel(dc)
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED, 
                    PeerConnection.IceConnectionState.COMPLETED -> RouterState.setWebRtcStatus(true)
                    PeerConnection.IceConnectionState.DISCONNECTED,
                    PeerConnection.IceConnectionState.FAILED,
                    PeerConnection.IceConnectionState.CLOSED -> RouterState.setWebRtcStatus(false)
                    else -> {}
                }
            }

            override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
        })
    }

    fun createLocalDataChannel() {
        if (dataChannel != null) return
        val init = DataChannel.Init().apply {
            ordered = false
            maxRetransmits = 0
        }
        val dc = peerConnection?.createDataChannel("phyfi_udp_channel", init)
        setupDataChannel(dc)
    }

    private fun setupDataChannel(dc: DataChannel?) {
        dc?.registerObserver(DataChannelObserverAdapter(onDataReceived))
        dataChannel = dc
    }

    fun processSignalingMessage(json: JSONObject) {
        when (json.optString("type")) {
            "offer" -> handleOffer(json)
            "answer" -> handleAnswer(json)
            "candidate" -> handleCandidate(json)
        }
    }

    private fun handleOffer(json: JSONObject) {
        val sdp = SessionDescription(SessionDescription.Type.OFFER, json.getString("sdp"))
        peerConnection?.setRemoteDescription(SimpleSdpObserver(), sdp)

        peerConnection?.createAnswer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                peerConnection?.setLocalDescription(SimpleSdpObserver(), desc)
                val payload = JSONObject()
                payload.put("type", "answer")
                payload.put("sdp", desc?.description)
                signalingClient.send(payload)
            }
        }, MediaConstraints())
    }

    private fun handleAnswer(json: JSONObject) {
        val sdp = SessionDescription(SessionDescription.Type.ANSWER, json.getString("sdp"))
        peerConnection?.setRemoteDescription(SimpleSdpObserver(), sdp)
    }

    private fun handleCandidate(json: JSONObject) {
        val candidate = IceCandidate(
            json.getString("sdpMid"),
            json.getInt("sdpMLineIndex"),
            json.getString("candidate")
        )
        peerConnection?.addIceCandidate(candidate)
    }

    fun sendData(data: ByteArray) {
        if (dataChannel?.state() == DataChannel.State.OPEN) {
            val buffer = DataChannel.Buffer(ByteBuffer.wrap(data), true)
            dataChannel?.send(buffer)
        }
    }
}