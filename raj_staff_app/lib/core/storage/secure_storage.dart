import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  final FlutterSecureStorage storage;

  SecureStorage(this.storage);

  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';

  Future<void> setToken(String token) => 
    storage.write(key: _tokenKey, value: token);

  Future<String?> getToken() => 
    storage.read(key: _tokenKey);

  Future<void> setUser(String userJson) => 
    storage.write(key: _userKey, value: userJson);

  Future<String?> getUser() => 
    storage.read(key: _userKey);

  Future<void> clearAuth() => 
    Future.wait([
      storage.delete(key: _tokenKey),
      storage.delete(key: _userKey),
    ]);
}
