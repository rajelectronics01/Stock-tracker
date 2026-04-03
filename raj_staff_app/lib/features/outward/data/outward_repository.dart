import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/outward_batch.dart';

/// Handles dispatch (outward) operations against Supabase.
///
/// Tables used:
///   outward_batches  – one row per dispatch
///   inventory        – rows updated: status → SOLD / DISPATCHED
class OutwardRepository {
  final _supabase = Supabase.instance.client;

  // ── Save dispatch ─────────────────────────────────────────────────────────

  /// Saves [batch] and updates inventory status for each serial number.
  ///
  /// Returns `true` on success.
  /// Throws an [Exception] with a user-friendly message on failure.
  Future<bool> saveOutward(OutwardBatch batch) async {
    debugPrint(
      '[OutwardRepository] saveOutward() – challan=${batch.challanNo}, '
      'buyer=${batch.buyerName}, type=${batch.saleType}, '
      'serials=${batch.serialNos.length}',
    );

    try {
      // 1. Upsert the outward batch record ------------------------------------
      await _supabase.from('outward_batches').upsert({
        'date': batch.date,
        'challan_no': batch.challanNo,
        'buyer_name': batch.buyerName,
        'sale_type': batch.saleType,
        'serial_nos': batch.serialNos,
        'staff_id': batch.staffId,
        'created_at': DateTime.now().toIso8601String(),
      });

      debugPrint('[OutwardRepository] saveOutward() – batch upserted');

      // 2. Update inventory rows to correct status ----------------------------
      final String newStatus =
          batch.saleType == 'Dealer Transfer' ? 'DISPATCHED' : 'SOLD';

      await _supabase
          .from('inventory')
          .update({
            'status': newStatus,
            'outward_date': DateTime.now().toIso8601String(),
            'outward_challan': batch.challanNo,
            'sold_to': batch.buyerName,
          })
          .in_('serial_no', batch.serialNos);

      debugPrint(
        '[OutwardRepository] saveOutward() – ${batch.serialNos.length} '
        'inventory rows updated to $newStatus',
      );

      return true;
    } on PostgrestException catch (e) {
      debugPrint('[OutwardRepository] saveOutward() – PostgrestException: ${e.message}');
      throw Exception('Database error saving dispatch: ${e.message}');
    } catch (e, st) {
      debugPrint('[OutwardRepository] saveOutward() – unexpected error: $e\n$st');
      throw Exception('Failed to save dispatch. Check your connection.');
    }
  }

  // ── Verify serial ─────────────────────────────────────────────────────────

  /// Checks whether [serial] exists in inventory with status 'IN STOCK'.
  ///
  /// Returns a result map on success, or null if not found / not in stock.
  Future<Map<String, dynamic>?> verifySerial(String serial) async {
    debugPrint('[OutwardRepository] verifySerial() – serial=$serial');

    try {
      final response = await _supabase
          .from('inventory')
          .select('serial_no, brand, model, godown, status')
          .ilike('serial_no', serial.trim())
          .maybeSingle();

      if (response == null) {
        debugPrint('[OutwardRepository] verifySerial() – NOT FOUND: $serial');
        return null;
      }

      final String status = (response['status'] as String?) ?? 'UNKNOWN';
      debugPrint('[OutwardRepository] verifySerial() – found: $serial, status=$status');

      return {
        'status': status,
        'data': response,
      };
    } on PostgrestException catch (e) {
      debugPrint('[OutwardRepository] verifySerial() – PostgrestException: ${e.message}');
      return null;
    } catch (e) {
      debugPrint('[OutwardRepository] verifySerial() – error: $e');
      return null;
    }
  }
}
