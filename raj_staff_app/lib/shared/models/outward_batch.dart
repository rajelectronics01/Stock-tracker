import 'package:equatable/equatable.dart';

class OutwardBatch extends Equatable {
  final String date;
  final String challanNo;
  final String buyerName;
  final String saleType;
  final String? staffId;
  final List<String> serialNos;

  const OutwardBatch({
    required this.date,
    required this.challanNo,
    required this.buyerName,
    required this.saleType,
    this.staffId,
    required this.serialNos,
  });

  Map<String, dynamic> toJson() => {
    'date': date,
    'challanNo': challanNo,
    'buyerName': buyerName,
    'saleType': saleType,
    'staffId': staffId,
    'serialNos': serialNos,
  };

  @override
  List<Object?> get props => [date, challanNo, buyerName, saleType, staffId, serialNos];
}
