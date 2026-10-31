import 'package:flutter/material.dart';

/// Marks the box [FocusRing] draws (the tests count the ones with a border).
const focusRingKey = ValueKey('focus-ring');

const _ringWidth = 4.0;

/// Draws a clear ring around [child] while it or something inside it has the focus, so that a person on the
/// other side of a room sees where the remote is. The default focus tint of buttons is too faint for that.
class FocusRing extends StatefulWidget {
  const FocusRing({super.key, required this.child, this.radius = 8});

  final Widget child;
  final double radius;

  @override
  State<FocusRing> createState() => _FocusRingState();
}

class _FocusRingState extends State<FocusRing> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (focused) => setState(() => _focused = focused),
      child: DecoratedBox(
        key: focusRingKey,
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          border: _focused ? Border.all(color: Theme.of(context).colorScheme.primary, width: _ringWidth) : null,
        ),
        child: widget.child,
      ),
    );
  }
}

/// The theme for a TV: buttons get a thick outline while they have the focus.
ThemeData tvTheme(ThemeData base) {
  final scheme = base.colorScheme;
  final side = WidgetStateProperty.resolveWith<BorderSide?>(
    (states) => states.contains(WidgetState.focused) ? BorderSide(color: scheme.primary, width: _ringWidth) : null,
  );
  return base.copyWith(
    focusColor: scheme.primary.withValues(alpha: 0.3),
    filledButtonTheme: FilledButtonThemeData(style: ButtonStyle(side: side)),
    outlinedButtonTheme: OutlinedButtonThemeData(style: ButtonStyle(side: side)),
    textButtonTheme: TextButtonThemeData(style: ButtonStyle(side: side)),
    iconButtonTheme: IconButtonThemeData(style: ButtonStyle(side: side)),
  );
}

/// How much larger text is on a TV, which is read from a sofa.
const tvTextScale = 1.25;
