import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/approve_code_screen.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

import 'harness.dart';

bool buttonOn(WidgetTester tester) => tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Approve')).onPressed != null;

void main() {
  testWidgets('labels the field and explains which characters a code has', (tester) async {
    final h = Harness();
    await h.pump(tester, const ApproveCodeScreen());
    expect(find.text('Code'), findsOneWidget);
    expect(shows('0, 1, I or O'), isTrue);
    expect(tester.widget<TextField>(find.byKey(const Key('code'))).maxLength, 6);
  });

  testWidgets('shows what the user types in capitals and drops spaces and dashes', (tester) async {
    final h = Harness();
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'ab-c d12');
    expect(fieldText(tester, 'code'), 'ABCD12');
  });

  testWidgets('needs all six characters', (tester) async {
    final h = Harness();
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'abc');
    expect(buttonOn(tester), isFalse);
    await enter(tester, 'code', 'abcd23');
    expect(buttonOn(tester), isTrue);
    expect(h.approvals, isEmpty);
  });

  testWidgets('approves the code in capitals and names the device', (tester) async {
    final h = Harness();
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'abcd23');
    await tapText(tester, 'Approve');
    expect(h.approvals.map((a) => a.code), ['ABCD23']);
    expect(shows('Signed in Living room TV'), isTrue);
    expect(fieldText(tester, 'code'), '');
  });

  testWidgets('unknown or expired code', (tester) async {
    final h = Harness();
    h.approveHandler = (_) => throw ConnectException(Code.notFound, 'unknown or expired code');
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'ABCD23');
    await tapText(tester, 'Approve');
    expect(shows('Code not found or expired'), isTrue);
    expect(shows('Signed in'), isFalse);
    expect(fieldText(tester, 'code'), 'ABCD23'); // kept so a typo can be fixed
  });

  testWidgets('passes the slow-down message through', (tester) async {
    final h = Harness();
    h.approveHandler = (_) => throw ConnectException(Code.resourceExhausted, 'try again in 2 s');
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'ABCD23');
    await tapText(tester, 'Approve');
    expect(shows('try again in 2 s'), isTrue);
  });

  testWidgets('a new attempt clears the old result', (tester) async {
    final h = Harness();
    var fail = true;
    h.approveHandler = (r) {
      if (fail) throw ConnectException(Code.notFound, 'x');
      return ApproveCodeResponse(deviceName: 'Living room TV');
    };
    await h.pump(tester, const ApproveCodeScreen());
    await enter(tester, 'code', 'ABCD23');
    await tapText(tester, 'Approve');
    expect(shows('Code not found or expired'), isTrue);
    fail = false;
    await enter(tester, 'code', 'ABCD24');
    await tapText(tester, 'Approve');
    expect(shows('Code not found or expired'), isFalse);
    expect(shows('Signed in Living room TV'), isTrue);
  });
}
