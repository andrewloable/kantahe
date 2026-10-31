import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/change_password_screen.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

import 'harness.dart';

Future<void> fill(WidgetTester tester, {String current = 'old password', String next = 'new password', String? confirm}) async {
  await enter(tester, 'current', current);
  await enter(tester, 'new', next);
  await enter(tester, 'confirm', confirm ?? next);
  await tapText(tester, 'Change password');
}

Future<Harness> open(WidgetTester tester, {bool mustChange = false, VoidCallback? onDone}) async {
  final h = Harness();
  await h.auth.signIn(
    AuthToken(
      token: 't',
      deviceId: 'd',
      user: User(id: 'u', mustChangePassword: mustChange),
    ),
  );
  await h.pump(tester, ChangePasswordScreen(onDone: onDone));
  return h;
}

void main() {
  testWidgets('three password fields, all hidden', (tester) async {
    await open(tester);
    for (final k in ['current', 'new', 'confirm']) {
      expect(tester.widget<TextField>(find.byKey(Key(k))).obscureText, isTrue, reason: k);
    }
    expect(shows('Choose a new password to continue.'), isFalse);
  });

  testWidgets('changes the password: sends both, clears the requirement, says the others were signed out', (tester) async {
    final h = await open(tester, mustChange: true);
    expect(shows('Choose a new password to continue.'), isTrue);
    await fill(tester);
    expect(h.changes.single.currentPassword, 'old password');
    expect(h.changes.single.newPassword, 'new password');
    expect(h.auth.passwordChangeRequired, isFalse);
    expect(shows('Password changed. Other devices were signed out.'), isTrue);
    expect(find.byKey(const Key('current')), findsNothing);
  });

  testWidgets('Continue calls onDone', (tester) async {
    var done = 0;
    await open(tester, onDone: () => done++);
    await fill(tester);
    await tapText(tester, 'Continue');
    expect(done, 1);
  });

  testWidgets('validation: the current password, the length, a different password, a matching repeat', (tester) async {
    final h = await open(tester);
    await tapText(tester, 'Change password');
    expect(shows('Enter your current password.'), isTrue);
    expect(shows('The new password must be 8 to 256 characters.'), isTrue);
    await fill(tester, current: 'old password', next: 'old password');
    expect(shows('The new password must differ from the current one.'), isTrue);
    await fill(tester, current: 'old password', next: 'new password', confirm: 'other password');
    expect(shows('The passwords do not match.'), isTrue);
    expect(h.changes, isEmpty);
  });

  testWidgets('a wrong current password says so, and nothing is cleared', (tester) async {
    final h = await open(tester, mustChange: true);
    h.changeHandler = (_) => throw ConnectException(Code.permissionDenied, 'wrong');
    await fill(tester);
    expect(shows('Current password is wrong.'), isTrue);
    expect(h.auth.passwordChangeRequired, isTrue);
    expect(fieldText(tester, 'new'), 'new password');
  });

  testWidgets('slow down and unreachable server', (tester) async {
    final h = await open(tester);
    h.changeHandler = (_) => throw ConnectException(Code.resourceExhausted, 'try again in 5 s');
    await fill(tester);
    expect(shows('try again in 5 s'), isTrue);
    h.changeHandler = (_) => throw ConnectException(Code.unavailable, 'down');
    await tapText(tester, 'Change password');
    expect(shows('Could not reach the server'), isTrue);
    expect(shows('try again in 5 s'), isFalse);
  });

  testWidgets('when the server insists on a new password there is a way out: sign out', (tester) async {
    final h = await open(tester, mustChange: true);
    await tapText(tester, 'Sign out');
    expect(h.auth.signedIn, isFalse);
  });

  testWidgets('no sign-out button when the change is voluntary', (tester) async {
    await open(tester);
    expect(find.text('Sign out'), findsNothing);
  });

  testWidgets('regression: the three fields are one autofill group with the right hints', (tester) async {
    await open(tester);
    expect(find.byType(AutofillGroup), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const Key('current'))).autofillHints, [AutofillHints.password]);
    expect(tester.widget<TextField>(find.byKey(const Key('new'))).autofillHints, [AutofillHints.newPassword]);
    expect(tester.widget<TextField>(find.byKey(const Key('confirm'))).autofillHints, [AutofillHints.newPassword]);
  });

  testWidgets('regression: a successful change lets the platform save the new password, a refused one does not', (tester) async {
    final h = await open(tester);
    List<Object?> finishes() => tester.testTextInput.log.where((c) => c.method == 'TextInput.finishAutofillContext').map((c) => c.arguments).toList();
    h.changeHandler = (_) => throw ConnectException(Code.permissionDenied, 'wrong');
    await fill(tester);
    expect(finishes(), isEmpty);
    h.changeHandler = (_) => ChangePasswordResponse();
    await tapText(tester, 'Change password');
    expect(finishes().first, true); // closing the form's autofill group may report it once more
    expect(finishes().every((a) => a == true), isTrue);
  });
}
