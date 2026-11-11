package com.ug.phyfi_router.core

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

@OptIn(ExperimentalCoroutinesApi::class)
object RouterState {
    private val _logs = MutableSharedFlow<String>(replay = 50)
    val logs = _logs.asSharedFlow()

    private val _isWebRtcConnected = MutableStateFlow(false)
    val isWebRtcConnected = _isWebRtcConnected.asStateFlow()

    private val _isBluetoothConnected = MutableStateFlow(false)
    val isBluetoothConnected = _isBluetoothConnected.asStateFlow()

    suspend fun log(message: String) {
        _logs.emit(message)
    }

    fun setWebRtcStatus(connected: Boolean) {
        _isWebRtcConnected.value = connected
    }

    fun setBluetoothStatus(connected: Boolean) {
        _isBluetoothConnected.value = connected
    }

    fun clear() {
        _logs.resetReplayCache()
        _isWebRtcConnected.value = false
        _isBluetoothConnected.value = false
    }
}
