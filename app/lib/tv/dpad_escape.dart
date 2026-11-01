import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/core/app_scope.dart';

/// Lets the arrow keys of a remote control leave a text field. A text field takes the arrows for its caret, so
/// on a TV the focus got stuck in it: Up and Down always move the focus on; Left does when the caret is at the
/// start of the text, Right when it is at the end (elsewhere they still move the caret). When nothing lies that
/// way the key stays with the field. Wrap every [TextField]: `DpadEscape(controller: c, builder: (focus, readOnly) => TextField(focusNode: focus, readOnly: readOnly, ...))`.
///
/// On a TV the field is also read-only until OK is pressed on it: a focused field would open the on-screen keyboard at once, even when the focus only
/// passes through, and the keyboard takes the arrow keys. Until OK every arrow leaves the field; after OK the field is edited as above; when the
/// focus leaves, the next visit is read-only again.
class DpadEscape extends StatefulWidget {
  const DpadEscape({super.key, required this.builder, this.controller});

  /// The field's controller: where its caret is decides whether Left and Right leave. Without one they always leave.
  final TextEditingController? controller;

  /// Builds the field; give [FocusNode] to its `focusNode` and [readOnly] to its `readOnly`.
  final Widget Function(FocusNode focus, bool readOnly) builder;

  @override
  State<DpadEscape> createState() => _DpadEscapeState();
}

class _DpadEscapeState extends State<DpadEscape> {
  late final FocusNode _focus = FocusNode(debugLabel: 'text field that the arrows can leave', onKeyEvent: _onKey);
  bool _tv = false;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_focusChanged);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _tv = AppScope.isTvOf(context);
  }

  @override
  void dispose() {
    _focus.removeListener(_focusChanged);
    _focus.dispose();
    super.dispose();
  }

  void _focusChanged() {
    if (!_focus.hasFocus && _editing) setState(() => _editing = false);
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent) return KeyEventResult.ignored;
    final key = event.logicalKey;
    if (_tv) {
      if (key == LogicalKeyboardKey.select || key == LogicalKeyboardKey.enter || key == LogicalKeyboardKey.numpadEnter) {
        if (event is KeyRepeatEvent) return KeyEventResult.handled;
        if (!_editing) {
          setState(() => _editing = true); // the field becomes editable and opens the keyboard
        } else {
          unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.show')); // Back closed it: OK shows it again
        }
        return KeyEventResult.handled;
      }
      if (!_editing) {
        // read-only: there is no caret to protect, every arrow leaves at once
        final direction = switch (key) {
          LogicalKeyboardKey.arrowUp => TraversalDirection.up,
          LogicalKeyboardKey.arrowDown => TraversalDirection.down,
          LogicalKeyboardKey.arrowLeft => TraversalDirection.left,
          LogicalKeyboardKey.arrowRight => TraversalDirection.right,
          _ => null,
        };
        if (direction == null) return KeyEventResult.ignored;
        return node.focusInDirection(direction) ? KeyEventResult.handled : KeyEventResult.ignored;
      }
    }
    final selection = widget.controller?.selection;
    final text = widget.controller?.text ?? '';
    final collapsed = selection == null || !selection.isValid || selection.isCollapsed;
    TraversalDirection? direction;
    if (key == LogicalKeyboardKey.arrowUp) {
      direction = TraversalDirection.up;
    } else if (key == LogicalKeyboardKey.arrowDown) {
      direction = TraversalDirection.down;
    } else if (key == LogicalKeyboardKey.arrowLeft && collapsed && (selection == null || !selection.isValid || selection.baseOffset <= 0)) {
      direction = TraversalDirection.left;
    } else if (key == LogicalKeyboardKey.arrowRight && collapsed && (selection == null || !selection.isValid || selection.extentOffset >= text.length)) {
      direction = TraversalDirection.right;
    }
    if (direction == null) return KeyEventResult.ignored;
    return node.focusInDirection(direction) ? KeyEventResult.handled : KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) => widget.builder(_focus, _tv && !_editing);
}
