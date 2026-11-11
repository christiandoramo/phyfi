package com.ug.phyfi_router.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.support.v4.media.session.MediaSessionCompat
import androidx.core.app.NotificationCompat
import com.ug.phyfi_router.ui.MainActivity

class ForegroundNotifier(private val context: Context) {
    private val channelId = "phyfi_media_channel"
    val notificationId = 101
    private val mediaSession = MediaSessionCompat(context, "PhyFiService")
    private val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createChannel()
    }

    private fun createChannel() {
        val channel =
                NotificationChannel(channelId, "PhyFi Media", NotificationManager.IMPORTANCE_LOW)
        notificationManager.createNotificationChannel(channel)
    }

    fun build(activePin: String?): Notification {
        val openAppIntent =
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
        val openAppPendingIntent =
                PendingIntent.getActivity(
                        context,
                        0,
                        openAppIntent,
                        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )

        val stopIntent = Intent(context, PhyFiService::class.java).apply { action = "STOP" }
        val stopPendingIntent =
                PendingIntent.getService(context, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(context, channelId)
                .setContentTitle("PhyFi Router")
                .setContentText("Roteamento. PIN: ${activePin ?: "N/A"}")
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentIntent(openAppPendingIntent)
                .addAction(
                        android.R.drawable.ic_menu_close_clear_cancel,
                        "Encerrar",
                        stopPendingIntent
                )
                .setStyle(
                        androidx.media.app.NotificationCompat.MediaStyle()
                                .setMediaSession(mediaSession.sessionToken)
                )
                .setOngoing(true)
                .build()
    }

    fun update(activePin: String?) {
        notificationManager.notify(notificationId, build(activePin))
    }

    fun release() {
        mediaSession.release()
    }
}
