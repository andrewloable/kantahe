import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/brand.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/shell/app_footer.dart';

/// Services whose server answers getServerInfo with [version], or with an error when [version] is null; [asked] counts the calls.
AppServices services(String? version, List<int> asked) {
  final auth = AuthStore(MemoryStore());
  final api = Api(
    FakeTransportBuilder().unary(AuthService.getServerInfo, (req, ctx) async {
      asked.add(1);
      if (version == null) throw ConnectException(Code.unavailable, 'down');
      return GetServerInfoResponse(version: version);
    }).build(),
  );
  return AppServices(
    serverUrl: ServerUrl(MemoryStore()),
    auth: auth,
    api: api,
    state: StateStore(client: api.session, auth: auth)..dispose(),
  );
}

Widget app(Widget child, {AppServices? s}) {
  final page = MaterialApp(home: Scaffold(body: child));
  return s == null ? page : AppRoot(services: s, child: page);
}

void main() {
  test('the copyright is the one of the LICENSE file (the web footer says the same)', () {
    expect(kCopyright, '© 2020 Andrew Loable');
  });

  testWidgets('shows the copyright and the version the server reports', (tester) async {
    final asked = <int>[];
    await tester.pumpWidget(app(const AppFooter(), s: services('1.2.3', asked)));
    await tester.pumpAndSettle();
    expect(find.text('© 2020 Andrew Loable · Kantahe 1.2.3'), findsOneWidget);
  });

  testWidgets('a server that does not answer leaves the copyright and the name, and no error on screen', (tester) async {
    final asked = <int>[];
    await tester.pumpWidget(app(const AppFooter(), s: services(null, asked)));
    await tester.pumpAndSettle();
    expect(find.text('© 2020 Andrew Loable · Kantahe'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('without any services above it (a widget on its own) it shows the copyright and throws nothing', (tester) async {
    await tester.pumpWidget(app(const AppFooter()));
    await tester.pumpAndSettle();
    expect(find.text('© 2020 Andrew Loable · Kantahe'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('asks the server once, however often it is rebuilt', (tester) async {
    final asked = <int>[];
    final s = services('1.2.3', asked);
    await tester.pumpWidget(app(const AppFooter(), s: s));
    await tester.pumpAndSettle();
    await tester.pumpWidget(app(const AppFooter(), s: s));
    await tester.pumpAndSettle();
    expect(asked, hasLength(1));
  });

  testWidgets('is not a stop for the keyboard or the TV remote', (tester) async {
    await tester.pumpWidget(app(const AppFooter(), s: services('1.2.3', <int>[])));
    await tester.pumpAndSettle();
    final focusable = find
        .descendant(of: find.byType(AppFooter), matching: find.byType(Focus))
        .evaluate()
        .map((e) => e.widget as Focus)
        .where((f) => f.canRequestFocus != false && !f.skipTraversal);
    expect(focusable, isEmpty);
  });
}
