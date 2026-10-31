import 'package:flutter_test/flutter_test.dart';

import 'package:kantahe/main.dart';

void main() {
  testWidgets('shows the app name', (WidgetTester tester) async {
    await tester.pumpWidget(const KantaheApp());

    expect(find.text('Kantahe'), findsOneWidget);
  });
}
