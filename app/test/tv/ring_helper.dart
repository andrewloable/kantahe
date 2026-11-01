import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/tv/focus.dart';

/// The first focus node that sits inside [control] and can take the focus (the control's own: its button, tile or chip).
FocusNode focusNodeInside(WidgetTester tester, Finder control) {
  final element = tester.element(control.first);
  for (final node in FocusManager.instance.rootScope.descendants) {
    final context = node.context;
    if (context == null || !node.canRequestFocus) continue;
    var inside = false;
    context.visitAncestorElements((ancestor) {
      if (identical(ancestor, element)) inside = true;
      return !inside;
    });
    if (inside) return node;
  }
  fail('no focusable node inside the control');
}

/// Gives [control] the focus the way the remote does and checks that a ring is drawn around it: the control sits inside
/// a [FocusRing] box that now has a border and a halo.
Future<void> expectRingOnFocus(WidgetTester tester, Finder control) async {
  expect(control, findsWidgets, reason: 'the control is on screen');
  focusNodeInside(tester, control).requestFocus();
  await tester.pump();
  await tester.pump();
  final ring = find.ancestor(of: control.first, matching: find.byType(FocusRing)).first;
  final boxes = tester.widgetList<DecoratedBox>(find.descendant(of: ring, matching: find.byKey(focusRingKey)));
  expect(boxes.where((b) => (b.decoration as BoxDecoration).border != null), isNotEmpty, reason: 'a ring is drawn around the focused control');
  expect(
    find.descendant(of: ring, matching: find.byKey(focusHaloKey)),
    findsOneWidget,
    reason: 'with its halo',
  );
}

/// With the focus elsewhere no ring is drawn around [control].
Future<void> expectNoRingWhenNotFocused(WidgetTester tester, Finder control) async {
  final rings = tester.widgetList<DecoratedBox>(find.ancestor(of: control.first, matching: find.byKey(focusRingKey)));
  expect(rings.where((b) => (b.decoration as BoxDecoration).border != null), isEmpty, reason: 'no ring while the control has no focus');
}
