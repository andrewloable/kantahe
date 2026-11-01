import 'package:flutter/painting.dart';

/// The background of the official splash (branding/build.py splash(), also the web manifest's background_color and the player's dark
/// paper): #0a0e22. It is NOT the ink #0c1230 of the logo's own shapes. Flat on purpose: the native splash is flat too, so the hand-over
/// from one to the other does not jump (the glow of the official image is only on the web).
const kSplashBackground = Color(0xFF0A0E22);

/// The splash logo's width in logical pixels. The native splash before Android 12 shows its bitmap (assets/branding/splash-logo-native.png,
/// 960 px: 240 dp at every density) at its own size, so the Flutter splash draws the logo as wide.
const kSplashLogoWidth = 240.0;

/// The official splash logo, tile and wordmark (a copy of branding/export/splash-logo.png).
const kSplashLogoAsset = 'assets/branding/splash-logo.png';
