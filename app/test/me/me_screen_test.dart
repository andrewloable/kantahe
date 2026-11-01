import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/me/favourites_screen.dart';
import 'package:kantahe/me/history_screen.dart';
import 'package:kantahe/me/me_screen.dart';
import 'package:kantahe/me/my_devices_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';
import 'package:kantahe/me/score_settings_screen.dart';
import 'package:kantahe/upload/upload_screen.dart';
import 'package:kantahe/auth/approve_code_screen.dart';
import 'package:kantahe/auth/change_password_screen.dart';

import 'fakes.dart';
import '../tv/ring_helper.dart';

Future<MeRig> open(WidgetTester tester, {bool uploader = false, bool admin = false}) async {
  final r = MeRig(uploader: uploader, admin: admin);
  await r.pump(tester, const MeScreen());
  return r;
}

void main() {
  testWidgets('a menu of the account pages', (tester) async {
    await open(tester);
    for (final t in ['Favourites', 'History', 'Playlists', 'My devices', 'Score', 'Change password', 'Approve a TV', 'Sign out']) {
      expect(find.text(t), findsOneWidget, reason: t);
    }
  });

  testWidgets('each entry opens its page', (tester) async {
    final pages = {
      'Favourites': FavouritesScreen,
      'History': HistoryScreen,
      'Playlists': PlaylistsScreen,
      'My devices': MyDevicesScreen,
      'Score': ScoreSettingsScreen,
      'Change password': ChangePasswordScreen,
      'Approve a TV': ApproveCodeScreen,
    };
    for (final e in pages.entries) {
      final r = await open(tester);
      r.server.devices = [];
      await tester.tap(find.text(e.key));
      await tester.pumpAndSettle();
      expect(find.byType(e.value), findsOneWidget, reason: e.key);
      await tester.pumpWidget(const SizedBox());
    }
  });

  testWidgets('Upload is offered to uploaders and administrators only', (tester) async {
    await open(tester);
    expect(find.text('Upload songs'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await open(tester, uploader: true);
    expect(find.text('Upload songs'), findsOneWidget);
    await tester.tap(find.text('Upload songs'));
    await tester.pumpAndSettle();
    expect(find.byType(UploadScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await open(tester, admin: true);
    expect(find.text('Upload songs'), findsOneWidget);
  });

  testWidgets('Sign out signs the device out on the server and here', (tester) async {
    final r = await open(tester);
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(r.server.revoked, ['me']);
    expect(r.auth.signedIn, isFalse);
  });

  testWidgets('Sign out signs out here even when the server cannot be reached', (tester) async {
    final r = await open(tester);
    r.server.onRevoke = (_) => throw Exception('offline');
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(r.auth.signedIn, isFalse);
  });

  testWidgets('the remote\'s focus on a menu entry shows the ring, and only then', (tester) async {
    await open(tester);
    final entry = find.widgetWithText(ListTile, 'Favourites');
    await expectNoRingWhenNotFocused(tester, entry);
    await expectRingOnFocus(tester, entry);
  });
}
