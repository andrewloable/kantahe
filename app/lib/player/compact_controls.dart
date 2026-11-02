import 'package:flutter/material.dart';
import 'package:kantahe/tv/focus.dart';

/// The buttons the player draws over the page. On a TV they are smaller than the rest of the app: the TV theme enlarges all text for the sofa
/// (tvTextScale), which makes a row of seven buttons fill the screen and wrap over the page's progress bar, so here that enlargement is taken
/// out again and the buttons are a little less tall and wide. The TV's focus look (the ring and the inverse fill) is kept. Everywhere else the
/// buttons are as they were.
class CompactControls extends StatelessWidget {
  const CompactControls({super.key, required this.tv, required this.child});

  final bool tv;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!tv) return child;
    final media = MediaQuery.of(context);
    final theme = Theme.of(context);
    final style = (theme.outlinedButtonTheme.style ?? const ButtonStyle()).merge(
      const ButtonStyle(
        padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16, vertical: 4)),
        minimumSize: WidgetStatePropertyAll(Size(0, 36)),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
    return MediaQuery(
      data: media.copyWith(textScaler: TextScaler.linear(media.textScaler.scale(1) / tvTextScale)),
      child: Theme(
        data: theme.copyWith(outlinedButtonTheme: OutlinedButtonThemeData(style: style)),
        child: child,
      ),
    );
  }
}
