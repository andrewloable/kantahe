package com.loabletech.kantahe

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Android TV has the leanback feature; phones do not.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tech.loable.kantahe/platform").setMethodCallHandler { call, result ->
            if (call.method == "isTv") {
                result.success(packageManager.hasSystemFeature("android.software.leanback"))
            } else {
                result.notImplemented()
            }
        }
    }
}
