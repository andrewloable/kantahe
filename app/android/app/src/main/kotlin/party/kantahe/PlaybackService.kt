package party.kantahe

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps Kantahe at foreground priority while a song plays on this device, so that the player page in the WebView goes on when another app
 * covers the app (a car's camera view, Home on a TV). Without it Android keeps a covered app as a cached process: it may be killed, and on a
 * busy head unit its audio got too little CPU (kantahe-go8.1). Started by the Dart side while the app is on screen (Android 12+ refuses a
 * start from the background) and stopped when the song stops playing here.
 */
class PlaybackService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Always into the foreground first, also for a stop: a service started with startForegroundService that stops before calling
        // startForeground makes Android end the app, which a quick Play then Pause could otherwise do.
        val notification = notification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        inForeground = true
        if (intent?.action == ACTION_STOP) {
            @Suppress("DEPRECATION")
            stopForeground(true)
            stopSelf()
        }
        return START_NOT_STICKY // a song that stopped with the app is not started again by the system
    }

    override fun onDestroy() {
        inForeground = false
        super.onDestroy()
    }

    private fun notification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW))
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Kantahe")
            .setContentText("Playing on this device")
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val ACTION_STOP = "party.kantahe.PLAYBACK_STOP"

        /** True from the service's startForeground until it is destroyed (main thread only). */
        @Volatile var inForeground = false
            private set
        private const val CHANNEL_ID = "playback"
        private const val NOTIFICATION_ID = 1
    }
}
