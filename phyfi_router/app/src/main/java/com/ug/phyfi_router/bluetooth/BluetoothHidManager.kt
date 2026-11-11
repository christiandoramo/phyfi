package com.ug.phyfi_router.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import com.ug.phyfi_router.core.RouterState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@SuppressLint("MissingPermission")
class BluetoothHidManager(private val context: Context) : BluetoothProfile.ServiceListener {

    private val bluetoothManager =
            context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter = bluetoothManager.adapter

    private var hidDevice: BluetoothHidDevice? = null
    private var connectedHost: BluetoothDevice? = null
    private var isRegistered = false

    private val scope = CoroutineScope(Dispatchers.IO)

    private val callback =
            object : BluetoothHidDevice.Callback() {
                override fun onAppStatusChanged(
                        pluggedDevice: BluetoothDevice?,
                        registered: Boolean
                ) {
                    isRegistered = registered
                    if (registered) {
                        logAsync("SDP HID Registrado. Tentando forçar conexão com o PC...")
                        connectToHost()
                    }
                }

                override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
                    when (state) {
                        BluetoothProfile.STATE_CONNECTED -> {
                            connectedHost = device
                            RouterState.setBluetoothStatus(true)
                            logAsync("Hospedeiro conectado e aceitando inputs: ${device.address}")
                        }
                        BluetoothProfile.STATE_DISCONNECTED -> {
                            connectedHost = null
                            RouterState.setBluetoothStatus(false)
                            logAsync("Hospedeiro desconectado.")
                        }
                    }
                }
            }

    fun initialize() {
        if (bluetoothAdapter?.isEnabled != true) {
            logAsync("ERRO: Bluetooth desligado no SO.")
            return
        }
        bluetoothAdapter.getProfileProxy(context, this, BluetoothProfile.HID_DEVICE)
    }

    override fun onServiceConnected(profile: Int, proxy: BluetoothProfile?) {
        if (profile == BluetoothProfile.HID_DEVICE) {
            hidDevice = proxy as BluetoothHidDevice
            registerApp()
        }
    }

    override fun onServiceDisconnected(profile: Int) {
        if (profile == BluetoothProfile.HID_DEVICE) {
            hidDevice = null
        }
    }

    private fun registerApp() {
        hidDevice?.registerApp(
                HidConstants.SDP_SETTINGS,
                null,
                null,
                context.mainExecutor,
                callback
        )
    }

    private fun connectToHost() {
        if (hidDevice == null) return
        val bondedDevices = bluetoothAdapter?.bondedDevices ?: return

        // Tenta iniciar a conexão de dados com os dispositivos pareados.
        // O OS ignorará os que não estiverem visíveis.
        for (device in bondedDevices) {
            hidDevice?.connect(device)
        }
    }

    fun sendKeyboardReport(report: ByteArray) {
        if (connectedHost == null) return
        hidDevice?.sendReport(connectedHost, HidConstants.REPORT_ID_KEYBOARD, report)
    }

    fun shutdown() {
        if (isRegistered) {
            hidDevice?.unregisterApp()
        }
        hidDevice?.let { bluetoothAdapter?.closeProfileProxy(BluetoothProfile.HID_DEVICE, it) }
    }

    private fun logAsync(msg: String) {
        scope.launch { RouterState.log(msg) }
    }
}
