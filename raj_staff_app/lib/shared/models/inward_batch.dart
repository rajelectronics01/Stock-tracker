import 'package:equatable/equatable.dart';

class InwardBatch extends Equatable {
  final String date;
  final String godown;
  final String brand;
  final String model;
  final String staffId;
  final List<String> serialNos;

  const InwardBatch({
    required this.date,
    required this.godown,
    required this.brand,
    required this.model,
    required this.staffId,
    required this.serialNos,
  });

  Map<String, dynamic> toJson() => {
    'date': date,
    'godown': godown,
    'brand': brand,
    'model': model,
    'staffId': staffId,
    'serialNos': serialNos,
  };

  @override
  List<Object?> get props => [date, godown, brand, model, staffId, serialNos];
}
