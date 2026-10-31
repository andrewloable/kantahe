import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/tv/dpad_escape.dart';

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
                    builder: (focus) => TextField(key: const Key('field'), controller: c, focusNode: focus),
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
}
