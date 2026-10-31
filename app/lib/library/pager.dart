import 'dart:collection';

import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/core/errors.dart';

/// One page of a list; [next] is the token of the following page, '' when this was the last.
class ListPage<T> {
  const ListPage(this.items, this.next);

  final List<T> items;
  final String next;
}

/// A list that is read page by page. Starting again, or cancelling, aborts the request that is running and
/// drops its answer; an item whose key is already in the list is not added twice (offset-based pages overlap
/// when the library changes between two requests).
class Pager<T> extends ChangeNotifier {
  Pager(this._fetch, {this._key});

  final Future<ListPage<T>> Function(String pageToken, AbortSignal signal) _fetch;
  final String Function(T item)? _key;

  final List<T> _items = [];
  bool _loading = false;
  String _error = '';
  bool _hasMore = false;
  bool _loaded = false;

  String _token = '';
  int _generation = 0;
  CancelableSignal? _running;
  final Set<String> _seen = {};

  /// A read-only view of the loaded items (not a copy: long lists are read on every build).
  List<T> get items => UnmodifiableListView(_items);
  bool get loading => _loading;

  /// A sentence for the last failure; '' when there was none.
  String get error => _error;
  bool get hasMore => _hasMore;

  /// The first page has arrived.
  bool get loaded => _loaded;

  /// Starts again from the first page (the request parameters are read when the page is asked for).
  Future<void> reset() {
    _running?.cancel();
    _generation++;
    _token = '';
    _seen.clear();
    _items.clear();
    _hasMore = false;
    _loaded = false;
    return _load(_generation);
  }

  Future<void> more() {
    if (!_hasMore || _loading) return Future.value();
    return _load(_generation);
  }

  /// Asks again for whatever failed last.
  Future<void> retry() => _loaded ? more() : reset();

  /// Abandons the request that is running (the screen is going away).
  void cancel() {
    _running?.cancel();
    _generation++;
    if (_loading) {
      _loading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _running?.cancel();
    _generation++;
    super.dispose();
  }

  List<T> _fresh(List<T> items) {
    final key = _key;
    if (key == null) return items;
    return items.where((item) => _seen.add(key(item))).toList();
  }

  Future<void> _load(int generation) async {
    final request = _running = CancelableSignal();
    _loading = true;
    _error = '';
    notifyListeners();
    try {
      final page = await _fetch(_token, request);
      if (generation != _generation) return;
      _items.addAll(_fresh(page.items));
      _token = page.next;
      _hasMore = page.next != '';
      _loaded = true;
    } catch (e) {
      if (generation == _generation) _error = problem(e, const {});
    } finally {
      if (generation == _generation) {
        _loading = false;
        notifyListeners();
      }
    }
  }
}
