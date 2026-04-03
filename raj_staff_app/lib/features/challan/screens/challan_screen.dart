import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../data/challan_repository.dart';
import '../../../shared/models/outward_batch.dart';
import 'package:get_it/get_it.dart';

class ChallanScreen extends StatefulWidget {
  final String id;
  const ChallanScreen({super.key, required this.id});

  @override
  State<ChallanScreen> createState() => _ChallanScreenState();
}

class _ChallanScreenState extends State<ChallanScreen> {
  final repo = GetIt.instance<ChallanRepository>();
  OutwardBatch? _batch;
  Map<String, dynamic>? _company;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  void _loadAll() async {
    final batch = await repo.getChallanData(widget.id);
    final company = await repo.getCompanyInfo();
    setState(() {
      _batch = batch;
      _company = company;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_batch == null) return const Scaffold(body: Center(child: Text('Error loading challan.')));

    return Scaffold(
      appBar: AppBar(
        title: Text('Challan: ${_batch!.challanNo}', style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: _printChallan, icon: const Icon(Icons.print)),
          IconButton(onPressed: _printChallan, icon: const Icon(Icons.share)),
        ],
      ),
      body: PdfPreview(
        build: (format) => _generatePdf(format),
        maxPageWidth: 700,
        canChangePageFormat: false,
        canChangeOrientation: false,
      ),
    );
  }

  Future<void> _printChallan() async {
    final pdf = await _generatePdf(PdfPageFormat.a4);
    await Printing.layoutPdf(onLayout: (format) async => pdf);
  }

  Future<Uint8List> _generatePdf(PdfPageFormat format) async {
    final pdf = pw.Document();
    
    pdf.addPage(pw.Page(
      pageFormat: format,
      build: (pw.Context context) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(_company!['name'], style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
            pw.Text(_company!['address'], style: const pw.TextStyle(fontSize: 10)),
            pw.Text('GSTIN: ${_company!['gstin']}', style: const pw.TextStyle(fontSize: 10)),
            pw.Text('PH: ${_company!['phone']}', style: const pw.TextStyle(fontSize: 10)),
            pw.Divider(thickness: 2),
            pw.SizedBox(height: 10),
            
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('TO: ${_batch!.buyerName}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    pw.Text('TYPE: ${_batch!.saleType}'),
                  ]
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text('CHALLAN: ${_batch!.challanNo}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    pw.Text('DATE: ${_batch!.date}'),
                  ]
                ),
              ]
            ),
            
            pw.SizedBox(height: 20),
            pw.TableHelper.fromTextArray(
              headers: ['SL NO', 'SERIAL NUMBER', 'DESCRIPTION'],
              data: List.generate(_batch!.serialNos.length, (i) => [
                '${i + 1}',
                _batch!.serialNos[i],
                'Home Appliance Unit'
              ]),
            ),
            
            pw.Spacer(),
            pw.Text('THANK YOU FOR YOUR BUSINESS', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey)),
            pw.Divider(),
            pw.Text('Authorized Signature', style: const pw.TextStyle(fontSize: 12)),
          ]
        );
      },
    ));
    
    return pdf.save();
  }
}
