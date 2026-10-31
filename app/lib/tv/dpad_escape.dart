import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Lets the arrow keys of a remote control leave a text field. A text field takes the arrows for its caret, so
/// on a TV the focus got stuck in it: Up and Down always move the focus on; Left does when the caret is at the
/// start of the text, Right when it is at the end (elsewhere they still move the caret). When nothing lies that
/// way the key stays with the field. Wrap every [TextField]: `DpadEscape(controller: c, builder: (focus) => TextField(focusNode: focus, ...))`.
class DpadEscape extends StatefulWidget {
  const DpadEscape({super.key, required this.builder, this.controller});

  /// The field's controller: where its caret is decides whether Left and Right leave. Without one they always leave.
  final TextEditingController? controller;

  /// Builds the field; give [FocusNode] to its `focusNode`.
  final Widget Function(FocusNode focus) builder;

  @override
  State<DpadEscape> createState() => _DpadEscapeState();
}

class _DpadEscapeState extends State<DpadEscape> {
  late final FocusNode _focus = FocusNode(debugLabel: 'text field that the arrows can leave', onKeyEvent: _onKey);

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent) return KeyEventResult.ignored;
    final key = event.logicalKey;
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
  Widget build(BuildContext context) => widget.builder(_focus);
}
