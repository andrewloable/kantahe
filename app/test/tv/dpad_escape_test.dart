import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/tv/dpad_escape.dart';

import '../library/fakes.dart';

/// [above]
/// [left] [ text field ] [right]
/// [below]
Future<TextEditingController> open(WidgetTester tester, {String text = 'abc'}) async {
  final c = TextEditingController(text: text);
  addTearDown(c.dispose);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Column(
          children: [
            TextButton(key: const Key('above'), onPressed: () {}, child: const Text('above')),
            Row(
              children: [
                TextButton(key: const Key('left'), onPressed: () {}, child: const Text('left')),
                Expanded(
                  child: DpadEscape(
                    controller: c,
                    builder: (focus, readOnly) => TextField(key: const Key('field'), controller: c, focusNode: focus, readOnly: readOnly),
                  ),
                ),
                TextButton(key: const Key('right'), onPressed: () {}, child: const Text('right')),
              ],
            ),
            TextButton(key: const Key('below'), onPressed: () {}, child: const Text('below')),
          ],
        ),
      ),
    ),
  );
  await tester.tap(find.byKey(const Key('field')));
  await tester.pump();
  return c;
}

/// Whether the focused widget is the one with [key], or inside it.
bool hasFocus(WidgetTester tester, String key) {
  final focused = FocusManager.instance.primaryFocus?.context;
  if (focused == null) return false;
  if (focused.widget.key == Key(key)) return true;
  var found = false;
  focused.visitAncestorElements((a) {
    if (a.widget.key == Key(key)) found = true;
    return !found;
  });
  return found;
}

Future<void> press(WidgetTester tester, LogicalKeyboardKey key) async {
  await tester.sendKeyEvent(key);
  await tester.pump();
}

void main() {
  testWidgets('regression: ArrowDown leaves the text field (the remote could not get out of a search box)', (tester) async {
    await open(tester);
    await press(tester, LogicalKeyboardKey.arrowDown);
    expect(hasFocus(tester, 'below'), isTrue);
  });

  testWidgets('regression: ArrowUp leaves the text field', (tester) async {
    await open(tester);
    await press(tester, LogicalKeyboardKey.arrowUp);
    expect(hasFocus(tester, 'above'), isTrue);
  });

  testWidgets('ArrowLeft at the start of the text leaves to the left; elsewhere it moves the caret', (tester) async {
    final c = await open(tester);
    c.selection = const TextSelection.collapsed(offset: 2);
    await press(tester, LogicalKeyboardKey.arrowLeft);
    expect(c.selection.baseOffset, 1);
    expect(hasFocus(tester, 'left'), isFalse);
    c.selection = const TextSelection.collapsed(offset: 0);
    await press(tester, LogicalKeyboardKey.arrowLeft);
    expect(hasFocus(tester, 'left'), isTrue);
  });

  testWidgets('ArrowRight at the end of the text leaves to the right; elsewhere it moves the caret', (tester) async {
    final c = await open(tester);
    c.selection = const TextSelection.collapsed(offset: 1);
    await press(tester, LogicalKeyboardKey.arrowRight);
    expect(c.selection.baseOffset, 2);
    expect(hasFocus(tester, 'right'), isFalse);
    c.selection = const TextSelection.collapsed(offset: 3);
    await press(tester, LogicalKeyboardKey.arrowRight);
    expect(hasFocus(tester, 'right'), isTrue);
  });

  testWidgets('an empty field: left and right leave at once', (tester) async {
    await open(tester, text: '');
    await press(tester, LogicalKeyboardKey.arrowRight);
    expect(hasFocus(tester, 'right'), isTrue);
  });

  testWidgets('typing is not touched: letters still reach the field', (tester) async {
    final c = await open(tester, text: '');
    await tester.enterText(find.byKey(const Key('field')), 'hi');
    expect(c.text, 'hi');
    expect(hasFocus(tester, 'above'), isFalse);
  });

  testWidgets('with nothing in that direction the arrow stays with the field', (tester) async {
    await open(tester);
    await press(tester, LogicalKeyboardKey.arrowDown); // to below
    await press(tester, LogicalKeyboardKey.arrowDown); // nothing further down: no error, focus stays
    expect(hasFocus(tester, 'below'), isTrue);
  });

  group('on a TV the keyboard opens only on OK', () {
    tearDown(() => FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic);

    FocusNode fieldNode(WidgetTester tester) => tester.widget<TextField>(find.byKey(const Key('field'))).focusNode!;

    /// The same layout as [open], inside an app that is a TV; the field is focused the way the remote does (not by a tap).
    Future<TextEditingController> openTv(WidgetTester tester, {String text = 'abc', bool tv = true}) async {
      final c = TextEditingController(text: text);
      addTearDown(c.dispose);
      await pumpScreen(
        tester,
        await FakeLibrary().services(isTv: tv),
        Scaffold(
          body: Column(
            children: [
              TextButton(key: const Key('above'), onPressed: () {}, child: const Text('above')),
              Row(
                children: [
                  TextButton(key: const Key('left'), onPressed: () {}, child: const Text('left')),
                  Expanded(
                    child: DpadEscape(
                      controller: c,
                      builder: (focus, readOnly) => TextField(key: const Key('field'), controller: c, focusNode: focus, readOnly: readOnly),
                    ),
                  ),
                  TextButton(key: const Key('right'), onPressed: () {}, child: const Text('right')),
                ],
              ),
              TextButton(key: const Key('below'), onPressed: () {}, child: const Text('below')),
            ],
          ),
        ),
      );
      fieldNode(tester).requestFocus();
      await tester.pump();
      return c;
    }

    testWidgets('REGRESSION: focusing the field does not open the keyboard; OK opens it', (tester) async {
      await openTv(tester);
      expect(tester.testTextInput.isVisible, isFalse, reason: 'the keyboard must not open by itself');
      await press(tester, LogicalKeyboardKey.select);
      expect(tester.testTextInput.isVisible, isTrue, reason: 'OK on the field opens it');
    });

    testWidgets('REGRESSION: before OK every arrow leaves the field at once, wherever the caret is', (tester) async {
      final c = await openTv(tester);
      c.selection = const TextSelection.collapsed(offset: 1);
      await press(tester, LogicalKeyboardKey.arrowLeft);
      expect(hasFocus(tester, 'left'), isTrue, reason: 'LEFT with the caret in the middle');
      await press(tester, LogicalKeyboardKey.arrowRight);
      expect(hasFocus(tester, 'field'), isTrue, reason: 'RIGHT from the button comes back to the field');
      c.selection = const TextSelection.collapsed(offset: 1);
      await press(tester, LogicalKeyboardKey.arrowRight);
      expect(hasFocus(tester, 'right'), isTrue, reason: 'RIGHT with the caret in the middle');
    });

    testWidgets('after OK the field is edited as before: LEFT moves the caret, Up and Down leave', (tester) async {
      final c = await openTv(tester);
      await press(tester, LogicalKeyboardKey.select);
      c.selection = const TextSelection.collapsed(offset: 2);
      await press(tester, LogicalKeyboardKey.arrowLeft);
      expect(hasFocus(tester, 'field'), isTrue, reason: 'LEFT only moves the caret while editing');
      await press(tester, LogicalKeyboardKey.arrowDown);
      expect(hasFocus(tester, 'below'), isTrue);
    });

    testWidgets('after Back closed the keyboard, OK opens it again', (tester) async {
      await openTv(tester);
      await press(tester, LogicalKeyboardKey.select);
      tester.testTextInput.hide();
      await tester.pump();
      expect(tester.testTextInput.isVisible, isFalse);
      await press(tester, LogicalKeyboardKey.select);
      expect(tester.testTextInput.isVisible, isTrue);
    });

    testWidgets('leaving the field ends the editing: coming back it is read-only again', (tester) async {
      await openTv(tester);
      await press(tester, LogicalKeyboardKey.select);
      await press(tester, LogicalKeyboardKey.arrowDown);
      tester.testTextInput.hide();
      fieldNode(tester).requestFocus();
      await tester.pump();
      expect(tester.testTextInput.isVisible, isFalse);
    });

    testWidgets('a phone is untouched: the keyboard opens on focus, the caret rules stay', (tester) async {
      await openTv(tester, tv: false);
      expect(tester.testTextInput.isVisible, isTrue);
    });
  });
}
