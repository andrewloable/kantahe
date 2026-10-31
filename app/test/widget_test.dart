import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/main.dart';

import 'auth/harness.dart';
import 'queue/fakes.dart';

void main() {
  testWidgets('signed in: the shell with its three destinations', (WidgetTester tester) async {
    final r = QueueRig();
    await r.services.serverUrl.set('http://srv:1'); // before the sign-in: a new address ends the session
    await r.signIn('me');
    r.setState(stateOf());
    await tester.pumpWidget(AppRoot(services: r.services, child: const KantaheApp()));
    await tester.pump();

    // it replaces the placeholder page that only said "Kantahe"
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Library'), findsWidgets);
    expect(find.text('Queue'), findsOneWidget);
    expect(find.text('Me'), findsOneWidget);
  });

  testWidgets('a signed-out app starts at the server address', (WidgetTester tester) async {
    final h = Harness(server: null);
    await tester.pumpWidget(AppRoot(services: h.services, child: const KantaheApp()));

    expect(find.text('Connect to your server'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
