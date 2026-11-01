import 'dart:async';

import 'package:bonsoir/bonsoir.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/server_discovery.dart';

/// The platform's discovery, driven by the test: what it announces, and what resolving a found service turns up.
class _FakeDiscovery with ServiceResolver implements BonsoirAction<BonsoirDiscoveryEvent> {
  _FakeDiscovery({this.onStart, this.resolved = const {}, this.failInitialize = false, this.failStart = false, this.failResolve = const {}});

  final void Function(_FakeDiscovery d)? onStart;

  /// By service name: what resolving that service gives (a service with addresses and a port).
  final Map<String, List<BonsoirService>> resolved;
  final bool failInitialize;
  final bool failStart;

  /// Names of the services that cannot be resolved.
  final Set<String> failResolve;
  final events = StreamController<BonsoirDiscoveryEvent>.broadcast();
  bool stopped = false;

  void found(String name) => events.add(
    BonsoirDiscoveryServiceFoundEvent(
      service: BonsoirService(name: name, type: kantaheServiceType, port: 0),
    ),
  );

  @override
  Stream<BonsoirDiscoveryEvent>? get eventStream => events.stream;
  @override
  Future<void> initialize() async {
    if (failInitialize) throw StateError('no network');
  }

  @override
  Future<void> start() async {
    if (failStart) throw StateError('permission denied');
    onStart?.call(this);
  }

  @override
  Future<void> stop() async => stopped = true;
  @override
  bool get isReady => true;
  @override
  bool get isStopped => stopped;

  @override
  FutureOr<void> resolveService(BonsoirService service) {
    if (failResolve.contains(service.name)) throw StateError('resolve failed');
    for (final r in resolved[service.name] ?? const <BonsoirService>[]) {
      events.add(BonsoirDiscoveryServiceResolvedEvent(service: r));
    }
  }

  @override
  FutureOr<bool> supportsMdnsHostname() => false;
}

class _FakeBonsoir extends BonsoirPlatformInterface {
  _FakeBonsoir(this.discovery);
  final _FakeDiscovery discovery;

  @override
  BonsoirAction<BonsoirBroadcastEvent> createBroadcastAction(BonsoirService service, {bool printLogs = false}) => throw UnimplementedError();
  @override
  BonsoirAction<BonsoirDiscoveryEvent> createDiscoveryAction(String type, {bool printLogs = false}) => discovery;
}

BonsoirService svc(String name, List<String> addresses, {int port = 8080, String? hostname}) =>
    BonsoirService(name: name, type: kantaheServiceType, port: port, hostAddresses: addresses, hostname: hostname);

const _window = Duration(milliseconds: 30);

void main() {
  group('serverUrlsOf', () {
    test('an IPv4 address and the port make the address of the server', () {
      expect(serverUrlsOf(['192.168.1.5'], null, 8080), ['http://192.168.1.5:8080']);
    });

    test('IPv4 comes first, an IPv6 address is put in brackets, link-local IPv6 is left out (it needs a zone to be usable)', () {
      expect(serverUrlsOf(['2001:db8::5', '192.168.1.5', 'fe80::1', 'FE80::2%en0'], null, 9000), ['http://192.168.1.5:9000', 'http://[2001:db8::5]:9000']);
    });

    test('the same address twice is one address', () {
      expect(serverUrlsOf(['10.0.0.2', '10.0.0.2'], null, 80), ['http://10.0.0.2:80']);
    });

    test('with no addresses the host name of the service is used, without its final dot', () {
      expect(serverUrlsOf([], 'box.local.', 8080), ['http://box.local:8080']);
    });

    test('addresses are preferred to the host name, which the phone may not be able to resolve', () {
      expect(serverUrlsOf(['10.0.0.2'], 'box.local.', 8080), ['http://10.0.0.2:8080']);
    });

    test('nothing usable gives nothing', () {
      expect(serverUrlsOf([], null, 8080), isEmpty);
      expect(serverUrlsOf(['fe80::1'], '', 8080), isEmpty);
      expect(serverUrlsOf(['not an address'], null, 8080), isEmpty);
    });
  });

  test('noServers finds nothing', () async {
    expect(await noServers(const Duration(seconds: 3)), isEmpty);
  });

  group('bonsoirFindServers (the real search, on a fake platform)', () {
    late BonsoirPlatformInterface original;
    setUp(() => original = BonsoirPlatformInterface.instance);
    tearDown(() => BonsoirPlatformInterface.instance = original);

    Future<List<ServerCandidate>> search(_FakeDiscovery d) {
      BonsoirPlatformInterface.instance = _FakeBonsoir(d);
      return bonsoirFindServers(_window);
    }

    test('a found service is resolved, and its addresses become the addresses of the server', () async {
      final d = _FakeDiscovery(
        onStart: (d) => d.found('Den'),
        resolved: {
          'Den': [
            svc('Den', ['172.17.0.1', '192.168.1.5'], port: 8080),
          ],
        },
      );
      final found = await search(d);
      expect(found.map((s) => s.name), ['Den']);
      expect(found.single.urls, ['http://172.17.0.1:8080', 'http://192.168.1.5:8080']);
    });

    test('the same server seen on two interfaces is one server with the addresses of both', () async {
      final d = _FakeDiscovery(
        onStart: (d) {
          d.found('Den');
          d.found('Den');
        },
        resolved: {
          'Den': [
            svc('Den', ['192.168.1.5']),
            svc('Den', ['10.0.0.7', '192.168.1.5']),
          ],
        },
      );
      final found = await search(d);
      expect(found.length, 1);
      expect(found.single.urls, ['http://192.168.1.5:8080', 'http://10.0.0.7:8080']);
    });

    test('two different servers are two', () async {
      final d = _FakeDiscovery(
        onStart: (d) {
          d.found('Den');
          d.found('Office');
        },
        resolved: {
          'Den': [
            svc('Den', ['192.168.1.5']),
          ],
          'Office': [
            svc('Office', ['192.168.1.9'], port: 9090),
          ],
        },
      );
      final found = await search(d);
      expect(found.map((s) => s.name), unorderedEquals(['Den', 'Office']));
      expect(found.firstWhere((s) => s.name == 'Office').urls, ['http://192.168.1.9:9090']);
    });

    test('a service that resolves to nothing usable is left out', () async {
      final d = _FakeDiscovery(
        onStart: (d) => d.found('Den'),
        resolved: {
          'Den': [
            svc('Den', ['fe80::1']),
          ],
        },
      );
      expect(await search(d), isEmpty);
    });

    test('the search is stopped when it is done', () async {
      final d = _FakeDiscovery();
      expect(await search(d), isEmpty);
      expect(d.stopped, isTrue);
    });

    test('never throws: a platform that cannot start, or cannot even initialise, finds nothing, and the search is still stopped', () async {
      final noStart = _FakeDiscovery(failStart: true);
      expect(await search(noStart), isEmpty);
      expect(noStart.stopped, isTrue);
      final noInit = _FakeDiscovery(failInitialize: true);
      expect(await search(noInit), isEmpty);
    });

    test('REGRESSION: an error on the event stream does not escape as an unhandled error', () async {
      final d = _FakeDiscovery(onStart: (d) => d.events.addError(StateError('stream broke')));
      expect(await search(d), isEmpty);
    });
    test('REGRESSION: a service that cannot be resolved is skipped, the others are still found, nothing escapes', () async {
      final d = _FakeDiscovery(
        onStart: (d) {
          d.found('Bad');
          d.found('Den');
        },
        failResolve: {'Bad'},
        resolved: {
          'Den': [
            svc('Den', ['192.168.1.5']),
          ],
        },
      );
      final found = await search(d);
      expect(found.map((s) => s.name), ['Den']);
    });
  });
}
