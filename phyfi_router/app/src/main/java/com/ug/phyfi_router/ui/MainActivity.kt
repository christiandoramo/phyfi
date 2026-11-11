package com.ug.phyfi_router.ui

import android.app.ActivityManager
import android.bluetooth.BluetoothAdapter
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.ug.phyfi_router.core.PermissionManager
import com.ug.phyfi_router.core.RouterState
import com.ug.phyfi_router.service.PhyFiService
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var routerUI: RouterUI
    private lateinit var permissionManager: PermissionManager
    private var hasHardwarePermissions = false

    private val enableBluetoothLauncher =
            registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
                checkBluetoothAndStartHardware()
            }

    private val serviceStoppedReceiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    RouterState.clear()
                    routerUI.clearLogs()
                    routerUI.setReadyState(false)
                    routerUI.log("Serviço de roteamento finalizado.")
                }
            }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        routerUI = RouterUI(this)
        setContentView(routerUI.layout)
        permissionManager = PermissionManager(this)

        val filter = IntentFilter("com.ug.phyfi_router.SERVICE_STOPPED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(serviceStoppedReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(serviceStoppedReceiver, filter)
        }

        bindUI()
        observeState()

        if (isServiceActivelyRunning()) {
            routerUI.log("Vinculado à sessão ativa no nível do SO.")
            hasHardwarePermissions = true
        } else {
            RouterState.clear()
            routerUI.clearLogs()
            requestHardwarePermissionsOnBoot()
        }
    }

    private fun requestHardwarePermissionsOnBoot() {
        permissionManager.checkAndRequest { allGranted ->
            hasHardwarePermissions = allGranted
            if (allGranted) {
                checkBluetoothAndStartHardware()
            } else {
                routerUI.log("AVISO: Permissões pendentes. O Roteador não funcionará.")
            }
        }
    }

    private fun checkBluetoothAndStartHardware() {
        val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
        if (bluetoothAdapter?.isEnabled == false) {
            val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
            enableBluetoothLauncher.launch(enableBtIntent)
            return
        }
        startHardwareService()
    }

    private fun bindUI() {
        routerUI.connectBtn.setOnClickListener {
            if (!hasHardwarePermissions) {
                requestHardwarePermissionsOnBoot()
                return@setOnClickListener
            }

            val pin = routerUI.pinInput.text.toString().trim()
            if (pin.length < 4) {
                Toast.makeText(this, "Insira um PIN válido", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            routerUI.setRoutingActiveState()
            startNetworkService(pin)
        }
    }

    private fun observeState() {
        lifecycleScope.launch { RouterState.logs.collect { msg -> routerUI.log(msg) } }
        lifecycleScope.launch {
            RouterState.isWebRtcConnected.collect { active -> routerUI.setWebRtcLed(active) }
        }
        lifecycleScope.launch {
            RouterState.isBluetoothConnected.collect { active ->
                routerUI.setBluetoothLed(active)
                routerUI.setReadyState(active)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun isServiceActivelyRunning(): Boolean {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        for (service in manager.getRunningServices(Int.MAX_VALUE)) {
            if (PhyFiService::class.java.name == service.service.className) return true
        }
        return false
    }

    private fun startHardwareService() {
        val serviceIntent =
                Intent(this, PhyFiService::class.java).apply { action = "INIT_HARDWARE" }
        startForegroundServiceCompat(serviceIntent)
    }

    private fun startNetworkService(pin: String) {
        val serviceIntent =
                Intent(this, PhyFiService::class.java).apply {
                    action = "START_NETWORK"
                    putExtra("ROOM_PIN", pin)
                }
        startForegroundServiceCompat(serviceIntent)
        lifecycleScope.launch { RouterState.log("Iniciando ponte de rede com PIN: $pin") }
    }

    private fun startForegroundServiceCompat(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(serviceStoppedReceiver)
    }
}
