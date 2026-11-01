import 'package:flutter/material.dart';

/// Marks the box [FocusRing] draws (the tests count the ones with a border).
const focusRingKey = ValueKey('focus-ring');

/// Marks the halo [FocusRing] draws outside the ring.
const focusHaloKey = ValueKey('focus-halo');

const _ringWidth = 4.0;
const _haloWidth = 2.0;

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
    final scheme = Theme.of(context).colorScheme;
    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (focused) => setState(() => _focused = focused),
      // passthrough: the control gets the same constraints as without the ring
      child: Stack(
        fit: StackFit.passthrough,
        clipBehavior: Clip.none,
        children: [
          DecoratedBox(
            key: focusRingKey,
            position: DecorationPosition.foreground,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(widget.radius),
              // a solid ring of the opposite tone of the page ...
              border: _focused ? Border.all(color: scheme.inverseSurface, width: _ringWidth) : null,
            ),
            child: widget.child,
          ),
          // ... and a halo of the page's own tone outside it, so that it shows on a dark and on a light picture alike. A
          // line, not a filled shadow: a shadow in a foreground box is a filled shape that hides the control.
          if (_focused)
            Positioned(
              left: -_haloWidth,
              top: -_haloWidth,
              right: -_haloWidth,
              bottom: -_haloWidth,
              child: IgnorePointer(
                child: DecoratedBox(
                  key: focusHaloKey,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(widget.radius + _haloWidth),
                    border: Border.all(color: scheme.surface, width: _haloWidth),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Builds [builder] with whether the control that holds it (the nearest focusable thing above) has the focus. For
/// a control whose own parts cannot be wrapped, such as the icon of a rail destination.
class FocusAware extends StatelessWidget {
  const FocusAware({super.key, required this.builder});

  final Widget Function(BuildContext context, bool focused) builder;

  @override
  Widget build(BuildContext context) {
    final node = Focus.maybeOf(context);
    if (node == null) return builder(context, false);
    return ListenableBuilder(listenable: node, builder: (context, _) => builder(context, node.hasFocus));
  }
}

/// Makes what has the focus larger by a clear step (about 8 %), so that it is the biggest thing on the screen. The
/// size is changed in drawing only: nothing around it moves. With animations switched off the step is made at once.
class FocusGrow extends StatefulWidget {
  const FocusGrow({super.key, required this.child});

  final Widget child;

  @override
  State<FocusGrow> createState() => _FocusGrowState();
}

class _FocusGrowState extends State<FocusGrow> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (focused) => setState(() => _focused = focused),
      child: AnimatedScale(
        scale: _focused ? 1.08 : 1,
        duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 150),
        child: widget.child,
      ),
    );
  }
}

/// The theme for a TV, where a person may be across the room and may not see well. Every kind of button looks the
/// same while it has the focus: a solid block of the opposite tone of the page (dark on a light theme, light on a dark
/// one) with a thick border of the page's own tone, which shows on a dark or a light picture alike. A border alone
/// was not enough: on a filled button it was the colour of the fill. Buttons that do not have the focus are quiet: a
/// filled button is tonal, not loud, so that none looks chosen already.
ThemeData tvTheme(ThemeData base) {
  final scheme = base.colorScheme;
  bool focused(Set<WidgetState> states) => states.contains(WidgetState.focused);
  final side = WidgetStateProperty.resolveWith<BorderSide?>((states) => focused(states) ? BorderSide(color: scheme.surface, width: _ringWidth) : null);
  ButtonStyle style({Color? quietBackground, Color? quietForeground}) => ButtonStyle(
    // a disabled button keeps the dimmed look of the default style (null here)
    backgroundColor: WidgetStateProperty.resolveWith<Color?>(
      (states) => focused(states) ? scheme.inverseSurface : (states.contains(WidgetState.disabled) ? null : quietBackground),
    ),
    foregroundColor: WidgetStateProperty.resolveWith<Color?>(
      (states) => focused(states) ? scheme.onInverseSurface : (states.contains(WidgetState.disabled) ? null : quietForeground),
    ),
    side: side,
  );
  return base.copyWith(
    focusColor: scheme.primary.withValues(alpha: 0.3),
    filledButtonTheme: FilledButtonThemeData(
      style: style(quietBackground: scheme.secondaryContainer, quietForeground: scheme.onSecondaryContainer),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(style: style()),
    textButtonTheme: TextButtonThemeData(style: style()),
    iconButtonTheme: IconButtonThemeData(style: style()),
    // the segments: only the focus look; the selected segment keeps its own fill and check mark when it is not focused
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith<Color?>((states) => focused(states) ? scheme.inverseSurface : null),
        foregroundColor: WidgetStateProperty.resolveWith<Color?>((states) => focused(states) ? scheme.onInverseSurface : null),
      ),
    ),
  );
}

/// How much larger text is on a TV, which is read from a sofa.
const tvTextScale = 1.25;
