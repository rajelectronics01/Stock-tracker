class OfflineQueue {
  // OfflineQueue completely safety-stripped for Web compatibility.
  Future<bool> get isSupported => Future.value(false);

  Future<void> addToQueue(String type, Map<String, dynamic> payload) async {
    // No-op for web version to ensure iPhone Safari compatibility.
  }

  Future<List<Map<String, dynamic>>> getQueue() async {
    return [];
  }

  Future<void> deleteFromQueue(String id) async {
  }
}
