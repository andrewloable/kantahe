import 'package:flutter/material.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

class BadgeColors {
  const BadgeColors(this.bg, this.fg);

  final Color bg;
  final Color fg;
}

class BadgeTheme {
  const BadgeTheme({required this.mp3, required this.midi});

  final BadgeColors mp3;
  final BadgeColors midi;
}

/// Badge colours, the same as the web app's: each pair reads at WCAG AA (a test checks it).
const badgePalette = (
  light: BadgeTheme(mp3: BadgeColors(Color(0xFF0B5D8A), Color(0xFFFFFFFF)), midi: BadgeColors(Color(0xFF7A3E00), Color(0xFFFFFFFF))),
  dark: BadgeTheme(mp3: BadgeColors(Color(0xFF4FD1FF), Color(0xFF0C1230)), midi: BadgeColors(Color(0xFFFFD23F), Color(0xFF0C1230))),
);

/// WCAG contrast ratio of two colours (the order does not matter).
double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/// What a screen reader says for a format: "MP3 file", "MIDI file", or nothing when it is unknown.
String formatLabel(Format format) => switch (format) {
  Format.FORMAT_MP3 => 'MP3 file',
  Format.FORMAT_MIDI => 'MIDI file',
  _ => '',
};

/// MP3 or MIDI, in words and in colour, so the two entries of one song can be told apart.
class FormatBadge extends StatelessWidget {
  const FormatBadge(this.format, {super.key});

  final Format format;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).brightness == Brightness.dark ? badgePalette.dark : badgePalette.light;
    final (String label, BadgeColors colors) = switch (format) {
      Format.FORMAT_MP3 => ('MP3', theme.mp3),
      Format.FORMAT_MIDI => ('MIDI', theme.midi),
      _ => ('', theme.mp3),
    };
    if (label.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: formatLabel(format),
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(4)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          child: Text(
            label,
            style: TextStyle(color: colors.fg, fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
  }
}
