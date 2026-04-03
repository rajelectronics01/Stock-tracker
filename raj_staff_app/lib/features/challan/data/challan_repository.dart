import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/outward_batch.dart';

class ChallanRepository {
  final _supabase = Supabase.instance.client;

  Future<OutwardBatch?> getChallanData(String id) async {
    try {
      final response = await _supabase.from('outwards').select().eq('id', id).single();
      return OutwardBatch(
        challanNo: response['challan_no'],
        buyerName: response['buyer_name'],
        saleType: response['sale_type'],
        serialNos: List<String>.from(response['serial_nos']),
        date: response['date'],
      );
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>> getCompanyInfo() async {
    try {
      return await _supabase.from('config').select().eq('type', 'company').single();
    } catch (e) {
      return {
        'name': 'RAJ ELECTRONICS',
        'address': 'Main Market, Mumbai',
        'gstin': '27AAAAA0000A1Z5',
        'phone': '+91 99999 99999'
      };
    }
  }
}
