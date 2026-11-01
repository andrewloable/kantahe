import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/approve_code_screen.dart';
import 'package:kantahe/auth/change_password_screen.dart';
import 'package:kantahe/library/library_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';

import '../library/fakes.dart';
import '../me/fakes.dart' as me;

/// Every text field of the app goes through DpadEscape: on a TV it must be read-only until OK (the keyboard opens only then), on a phone never.
void main() {
  tearDown(() => FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic);

  Future<void> pumpMe(WidgetTester tester, Widget screen, {required bool tv}) async {
    final r = me.MeRig(isTv: tv);
    await r.pump(tester, screen);
    await tester.pumpAndSettle();
  }

  final screens = <String, Future<void> Function(WidgetTester tester, bool tv)>{
    'Library search': (tester, tv) async {
      await pumpScreen(tester, await FakeLibrary().services(isTv: tv), const LibraryScreen());
      await settle(tester);
    },
    'Playlists name field': (tester, tv) => pumpMe(tester, const PlaylistsScreen(), tv: tv),
    'Approve a TV': (tester, tv) => pumpMe(tester, const ApproveCodeScreen(), tv: tv),
    'Change password': (tester, tv) => pumpMe(tester, const ChangePasswordScreen(), tv: tv),
  };

  for (final e in screens.entries) {
    testWidgets('REGRESSION: on a TV the text field of ${e.key} is read-only until OK', (tester) async {
      await e.value(tester, true);
      final fields = tester.widgetList<TextField>(find.byType(TextField)).toList();
      expect(fields, isNotEmpty);
      for (final f in fields) {
        expect(f.readOnly, isTrue, reason: 'the keyboard must not open by itself');
      }
    });

    testWidgets('on a phone the text field of ${e.key} is editable at once', (tester) async {
      await e.value(tester, false);
      for (final f in tester.widgetList<TextField>(find.byType(TextField))) {
        expect(f.readOnly, isFalse);
      }
    });
  }
}
