import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';

/// On a TV a screen that is pushed arrives with the focus on the route itself: nothing shows a ring and the remote seems dead until a key is
/// pressed. This gives the first control of the screen the focus after the first frame, unless a control has it already (an autofocus).
/// Phones and tablets are not touched.
class TvEntryFocus extends StatefulWidget {
  const TvEntryFocus({super.key, required this.child});

  final Widget child;

  @override
  State<TvEntryFocus> createState() => _TvEntryFocusState();
}

class _TvEntryFocusState extends State<TvEntryFocus> {
  bool _asked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_asked) return;
    _asked = true;
    if (!AppScope.isTvOf(context)) return;
    // An autofocus is applied in a microtask after the frame: look one microtask later, so that it is not overridden.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      scheduleMicrotask(() {
        if (!mounted) return;
        final scope = FocusScope.of(context);
        // findFirstFocus keeps a focus that the scope has already (an autofocus)
        final first = FocusTraversalGroup.of(context).findFirstFocus(scope);
        if (first != null && first != scope) first.requestFocus();
      });
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
