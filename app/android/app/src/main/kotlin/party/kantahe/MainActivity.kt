package party.kantahe

import android.content.Intent
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Android TV has the leanback feature; phones do not.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "party.kantahe/platform").setMethodCallHandler { call, result ->
            when (call.method) {
                "isTv" -> result.success(packageManager.hasSystemFeature("android.software.leanback"))
                // the foreground service that keeps a song playing while another app covers this one (PlaybackService)
                "playbackStart" -> platformCall(result) { startPlayback(Intent(this, PlaybackService::class.java)) }
                // Once the service is in the foreground a plain stopService ends it, also while the app is covered (a new start from there
                // could be refused). Before that (a stop right after a start, while the app is still on screen) the stop goes through the
                // service, which enters the foreground first: stopping it earlier would make Android end the app.
                "playbackStop" -> platformCall(result) {
                    val intent = Intent(this, PlaybackService::class.java)
                    if (PlaybackService.inForeground) stopService(intent) else startPlayback(intent.setAction(PlaybackService.ACTION_STOP))
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun startPlayback(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    // A refused start (Android 12+ from the background) comes back as an error to Dart instead of crashing the app.
    private fun platformCall(result: MethodChannel.Result, action: () -> Unit) {
        try {
            action()
            result.success(null)
        } catch (e: Exception) {
            result.error(e.javaClass.simpleName, e.message, null)
        }
    }
}
