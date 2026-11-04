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

/// MP3 or MIDI, in words and in colour, so the two entries of one song can be told apart. [timing] adds a small W (word by word) or L (line by
/// line) and [vocals] a V (a separate vocals track), outlined chips after the format; none of them for an unread song or one without vocals.
class FormatBadge extends StatelessWidget {
  const FormatBadge(this.format, {super.key, this.timing = LyricTiming.LYRIC_TIMING_UNSPECIFIED, this.vocals = false});

  final Format format;
  final LyricTiming timing;
  final bool vocals;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).brightness == Brightness.dark ? badgePalette.dark : badgePalette.light;
    final (String label, BadgeColors colors) = switch (format) {
      Format.FORMAT_MP3 => ('MP3', theme.mp3),
      Format.FORMAT_MIDI => ('MIDI', theme.midi),
      _ => ('', theme.mp3),
    };
    final formatBadge = label.isEmpty
        ? null
        : Semantics(
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
    final flags = [
      if (timing == LyricTiming.LYRIC_TIMING_WORD) _Flag('W', 'Word-by-word lyrics'),
      if (timing == LyricTiming.LYRIC_TIMING_LINE) _Flag('L', 'Line-by-line lyrics'),
      if (vocals) const _Flag('V', 'Separate vocals track available'),
    ];
    if (flags.isEmpty) return formatBadge ?? const SizedBox.shrink();
    // wraps inside a narrow place (a phone row) instead of squeezing the title next to it
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 64),
      child: Wrap(spacing: 4, runSpacing: 2, alignment: WrapAlignment.end, crossAxisAlignment: WrapCrossAlignment.center, children: [?formatBadge, ...flags]),
    );
  }
}

/// One outlined letter that says something about the song (never colour alone: the letter is the content, the label is spoken).
class _Flag extends StatelessWidget {
  const _Flag(this.letter, this.label);

  final String letter;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurface;
    return Tooltip(
      message: label,
      child: Semantics(
        label: label,
        excludeSemantics: true,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: color),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            child: Text(
              letter,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }
}
