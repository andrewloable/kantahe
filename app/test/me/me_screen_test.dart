import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/me/favourites_screen.dart';
import 'package:kantahe/me/history_screen.dart';
import 'package:kantahe/me/me_screen.dart';
import 'package:kantahe/me/my_devices_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';
import 'package:kantahe/me/score_settings_screen.dart';
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

  testWidgets('the Me menu has no Upload, whatever the roles of the user: songs are added in the web app', (tester) async {
    for (final roles in [(uploader: false, admin: false), (uploader: true, admin: false), (uploader: false, admin: true), (uploader: true, admin: true)]) {
      await open(tester, uploader: roles.uploader, admin: roles.admin);
      expect(find.textContaining('Upload'), findsNothing, reason: '$roles');
      for (final t in ['Favourites', 'History', 'Playlists', 'My devices', 'Appearance', 'Score', 'Change password', 'Approve a TV', 'Sign out']) {
        expect(find.text(t), findsOneWidget, reason: '$t for $roles');
      }
      await tester.pumpWidget(const SizedBox());
    }
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

  group('on a TV', () {
    tearDown(() => FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic);

    for (final label in ['Favourites', 'History', 'Playlists', 'My devices', 'Appearance', 'Score', 'Change password', 'Approve a TV']) {
      testWidgets('REGRESSION: $label opens with a control focused (not with the page itself, nor the menu behind it)', (tester) async {
        final r = MeRig(isTv: true);
        await r.pump(tester, const MeScreen());
        await tester.tap(find.text(label));
        await tester.pumpAndSettle();
        final focus = FocusManager.instance.primaryFocus;
        expect(focus, isNotNull);
        expect(focus, isNot(isA<FocusScopeNode>()), reason: 'the focus is on the route itself: nothing shows a ring');
        expect(focus!.context!.findAncestorWidgetOfExactType<MeScreen>(), isNull, reason: 'the focus stayed in the menu behind the page');
      });
    }

    testWidgets('on a phone the page is left alone (no focus is forced)', (tester) async {
      final r = MeRig();
      await r.pump(tester, const MeScreen());
      await tester.tap(find.text('Appearance'));
      await tester.pumpAndSettle();
      expect(FocusManager.instance.primaryFocus is FocusScopeNode || FocusManager.instance.primaryFocus == null, isTrue);
    });
  });
}
