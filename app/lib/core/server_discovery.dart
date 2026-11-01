import 'dart:async';

import 'package:bonsoir/bonsoir.dart';
import 'package:kantahe/core/server_url.dart';

/// The DNS-SD service type the server announces (server/internal/discovery).
const kantaheServiceType = '_kantahe._tcp';

/// One server found on the network: the addresses it can be reached on, best first. A host with several network
/// interfaces announces several addresses for the one server, so the caller asks each and keeps the first that answers.
class ServerCandidate {
  const ServerCandidate(this.name, this.urls);

  /// What the network calls the server (its mDNS instance name).
  final String name;

  /// Base addresses (http://host:port, no trailing slash), best first.
  final List<String> urls;
}

/// Looks for servers for about [window] and returns what it found; never throws (no Wi-Fi, no permission and
/// a platform without discovery all mean "found nothing").
typedef FindServers = Future<List<ServerCandidate>> Function(Duration window);

/// A search that finds nothing: tests, and the integration runs that type the address.
Future<List<ServerCandidate>> noServers(Duration window) async => const [];

/// The addresses of a server from what the platform tells about a resolved service: IPv4 first, then IPv6 in
/// brackets (link-local IPv6 is left out: it cannot be used without a zone), then, only when there is no address, the
/// host name without its final dot. Each is normalised, none repeats.
List<String> serverUrlsOf(List<String> addresses, String? hostname, int port) {
  bool isV6(String a) => a.contains(':');
  bool linkLocal(String a) => a.toLowerCase().startsWith('fe80');
  final v4 = [
    for (final a in addresses)
      if (!isV6(a)) a,
  ];
  final v6 = [
    for (final a in addresses)
      if (isV6(a) && !linkLocal(a)) '[${a.split('%').first}]',
  ];
  var hosts = [...v4, ...v6];
  final name = hostname?.replaceAll(RegExp(r'\.+$'), '') ?? '';
  if (hosts.isEmpty && name.isNotEmpty) hosts = [name];
  final out = <String>[];
  for (final h in hosts) {
    final url = ServerUrl.normalize('http://$h:$port');
    if (url != null && !out.contains(url)) out.add(url);
  }
  return out;
}

/// Browses the network for [kantaheServiceType] for [window] with the platform's own service discovery (Android
/// NsdManager, Apple Bonjour). Instances announced on several interfaces are one server.
Future<List<ServerCandidate>> bonsoirFindServers(Duration window) async {
  final found = <String, List<String>>{}; // by instance name: the same server seen on each of its interfaces
  BonsoirDiscovery? discovery;
  StreamSubscription<BonsoirDiscoveryEvent>? events;
  try {
    final d = discovery = BonsoirDiscovery(type: kantaheServiceType);
    await d.initialize();
    events = d.eventStream!.listen((event) {
      switch (event) {
        case BonsoirDiscoveryServiceFoundEvent():
          event.service.resolve(d.serviceResolver).catchError((Object _) {}); // one that cannot be resolved is skipped
        case BonsoirDiscoveryServiceResolvedEvent() || BonsoirDiscoveryServiceUpdatedEvent():
          final s = event.service!;
          final urls = found.putIfAbsent(s.name, () => []);
          for (final u in serverUrlsOf(s.hostAddresses, s.hostname, s.port)) {
            if (!urls.contains(u)) urls.add(u);
          }
        default:
      }
    }, onError: (Object _) {}); // an error on the stream would otherwise escape as an unhandled error
    await d.start();
    await Future<void>.delayed(window);
  } catch (_) {
    // no network, no permission to look at it, no discovery on this platform: nothing found
  } finally {
    await events?.cancel();
    try {
      await discovery?.stop();
    } catch (_) {
      // it never started
    }
  }
  return [
    for (final e in found.entries)
      if (e.value.isNotEmpty) ServerCandidate(e.key, e.value),
  ];
}
