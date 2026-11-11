package com.ug.phyfi_router.service

import android.content.Context
import android.os.PowerManager

class WakeLockManager(context: Context) {
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var wakeLock: PowerManager.WakeLock? = null

    fun acquire() {
        if (wakeLock == null) {
            wakeLock =
                    powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PhyFi::DSPWakeLock")
        }
        wakeLock?.acquire(10 * 60 * 1000L)
    }

    fun release() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }
}
