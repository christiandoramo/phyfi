package com.ug.phyfi_router.core

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class PermissionManager(private val activity: AppCompatActivity) {
    private val permissionsToRequest: Array<String> = getPermissionsForCurrentSdk()
    private var onResultCallback: ((Boolean) -> Unit)? = null

    // O registro OBRIGATORIAMENTE deve acontecer durante o onCreate da Activity
    private val requestLauncher =
            activity.registerForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
            ) { permissionsMap ->
                val allGranted =
                        permissionsToRequest.all { perm ->
                            permissionsMap[perm] == true ||
                                    ContextCompat.checkSelfPermission(activity, perm) ==
                                            PackageManager.PERMISSION_GRANTED
                        }
                onResultCallback?.invoke(allGranted)
            }

    fun checkAndRequest(onResult: (Boolean) -> Unit) {
        this.onResultCallback = onResult
        val missingPermissions =
                permissionsToRequest.filter {
                    ContextCompat.checkSelfPermission(activity, it) !=
                            PackageManager.PERMISSION_GRANTED
                }

        if (missingPermissions.isEmpty()) {
            onResult(true)
        } else {
            requestLauncher.launch(missingPermissions.toTypedArray())
        }
    }

    private fun getPermissionsForCurrentSdk(): Array<String> {
        val list = mutableListOf(Manifest.permission.RECORD_AUDIO)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            list.add(Manifest.permission.BLUETOOTH_CONNECT)
            list.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            list.add(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            list.add(Manifest.permission.BLUETOOTH)
            list.add(Manifest.permission.BLUETOOTH_ADMIN)
        }

        return list.toTypedArray()
    }
}
