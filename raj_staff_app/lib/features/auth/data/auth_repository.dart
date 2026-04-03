import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/constants.dart';

/// Handles staff authentication against the custom `employees` Supabase table.
class AuthRepository {
  final _supabase = Supabase.instance.client;

  // ── Current session (held in memory; restored via SecureStorage in di.dart) ─

  Map<String, dynamic>? _currentEmployee;

  Map<String, dynamic>? get currentEmployee => _currentEmployee;

  /// Returns the logged-in employee's ID, or null if not authenticated.
  String? getCurrentUserId() => _currentEmployee?[AppConstants.empIdColumn] as String?;

  /// Returns the logged-in employee's display name.
  String getCurrentUserName() =>
      (_currentEmployee?[AppConstants.empNameColumn] as String?) ?? 'Staff';

  // ── Login ─────────────────────────────────────────────────────────────────

  /// Finds the employee by [username] (emp_id) and verifies [password].
  Future<bool> login(String username, String password) async {
    debugPrint('[AuthRepository] login() called for emp_id: $username');

    final String trimmedId = username.trim();
    final String trimmedPw = password.trim();

    if (trimmedId.isEmpty || trimmedPw.isEmpty) {
      debugPrint('[AuthRepository] login() – empty username or password');
      return false;
    }

    final String passwordHash = _simpleHash(trimmedPw);

    // ── Admin Fallback (Matches Next.js logic) ──────────────────────────
    // This allows the admin to log in even if the database is being setup.
    if (trimmedId.toUpperCase() == 'ADMIN' && (trimmedPw == 'admin123' || passwordHash == _simpleHash('admin123'))) {
      _currentEmployee = {
        'emp_id': 'ADMIN',
        'name': 'Administrator',
        'role': 'admin',
        'active': true,
      };
      debugPrint('[AuthRepository] login() – SUCCESS (Admin Fallback)');
      return true;
    }

    try {
      // Query the employees table directly (case-insensitive username).
      final List<dynamic> rows = await _supabase
          .from(AppConstants.employeesTable)
          .select()
          .ilike(AppConstants.empIdColumn, trimmedId)
          .limit(1);

      if (rows.isEmpty) {
        debugPrint('[AuthRepository] login() – emp_id not found: $trimmedId');
        return false;
      }

      final Map<String, dynamic> emp = rows.first as Map<String, dynamic>;

      // Verify password. The DB stores the hashed password (to match Next.js simpleHash).
      final String? storedPw = emp['password'] as String?;
      
      // Allow both plain-text (for migration) and hashed passwords
      if (storedPw == null || (storedPw != trimmedPw && storedPw != passwordHash)) {
        debugPrint('[AuthRepository] login() – password mismatch for: $trimmedId');
        return false;
      }

      // Check active flag
      final dynamic activeFlag = emp['active'];
      if (activeFlag != null && activeFlag == false) {
        debugPrint('[AuthRepository] login() – account deactivated: $trimmedId');
        throw Exception('Account is deactivated. Contact admin.');
      }

      _currentEmployee = emp;
      debugPrint('[AuthRepository] login() – SUCCESS for: $trimmedId');
      return true;
    } on PostgrestException catch (e) {
      if (e.code == 'PGRST205' || e.code == '42P01') {
        throw Exception('Database Error: Table "employees" is missing in Supabase. Run the SQL script from the dashboard.');
      }
      rethrow;
    } catch (e, st) {
      debugPrint('[AuthRepository] login() – unexpected error: $e\n$st');
      throw Exception('Login failed. Please check your connection and try again.');
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    debugPrint('[AuthRepository] logout() called');
    _currentEmployee = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Matching implementation of the Next.js `simpleHash` function.
  String _simpleHash(String str) {
    int hash = 0;
    for (int i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.codeUnitAt(i);
      hash = hash & 0xFFFFFFFF; // Ensure 32-bit integer behavior
    }
    // Handle signed 32-bit behavior like JavaScript '| 0'
    if (hash > 0x7FFFFFFF) hash -= 0x100000000;
    return hash.toString();
  }
}
