import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme.dart';
import '../../../shared/widgets/scanner_widget.dart';
import '../../../shared/widgets/serial_chip.dart';
import '../bloc/outward_bloc.dart';
import '../../../shared/models/outward_batch.dart';

import '../../auth/bloc/auth_bloc.dart';

class OutwardScreen extends StatefulWidget {
  const OutwardScreen({super.key});

  @override
  State<OutwardScreen> createState() => _OutwardScreenState();
}

class _OutwardScreenState extends State<OutwardScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _buyerController = TextEditingController();
  final TextEditingController _challanController = TextEditingController();
  String _selectedSaleType = 'Counter Sale';
  DateTime _selectedDate = DateTime.now();
  final List<String> _scannedSerials = [];
  final ScrollController _chipScrollController = ScrollController();

  final List<String> _saleTypes = ['Counter Sale', 'Dealer Sale', 'Service Center'];

  @override
  void initState() {
    super.initState();
    _challanController.text = 'RE-${DateFormat('HHmmss').format(DateTime.now())}';
  }

  void _onScan(String serial) {
    if (_scannedSerials.contains(serial)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('⚠️ Already in list: $serial'), backgroundColor: AppTheme.amber),
      );
      return;
    }
    context.read<OutwardBloc>().add(OutwardVerifySerial(serial));
  }

  void _addVerifiedSerial(String s) {
    setState(() => _scannedSerials.add(s));
    _scrollToBottom();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_chipScrollController.hasClients) {
        _chipScrollController.animateTo(
          _chipScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<OutwardBloc, OutwardState>(
      listener: (context, state) {
        if (state is OutwardVerifyResult) {
          if (state.isValid) {
            _addVerifiedSerial(state.serial);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('✅ Serial Verified'), backgroundColor: AppTheme.green, duration: Duration(milliseconds: 800)),
            );
          } else {
            _showErrorDialog('Verification Failed', 'Serial ${state.serial} is ${state.errorMessage}.');
          }
        }
        if (state is OutwardSaveSuccess) {
          _showSaveSuccess(state.challanNo);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('📤 Outward Dispatch', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          leading: IconButton(onPressed: () => context.go('/inward'), icon: const Icon(Icons.arrow_back)),
        ),
        body: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 150, top: 16, left: 16, right: 16),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildBuyerHeader(),
                    const SizedBox(height: 20),
                    _buildScannerSection(),
                    const SizedBox(height: 20),
                    _buildScannedList(),
                  ],
                ),
              ),
            ),
            _buildFixedBottom(),
          ],
        ),
      ),
    );
  }

  Widget _buildBuyerHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.border)),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _selectedDate, firstDate: DateTime(2020), lastDate: DateTime(2030));
                    if (d != null) setState(() => _selectedDate = d);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Dispatch Date'),
                    child: Text(DateFormat('dd MMM yyyy').format(_selectedDate)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedSaleType,
                  decoration: const InputDecoration(labelText: 'Sale Type'),
                  items: _saleTypes.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _selectedSaleType = v);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _buyerController,
            decoration: const InputDecoration(labelText: 'Buyer / Customer Name'),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _challanController,
            decoration: const InputDecoration(labelText: 'Challan Number'),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildScannerSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('📷 SCAN SERIALS TO VERIFY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.textDim)),
            if (context.watch<OutwardBloc>().state is OutwardVerifying)
              const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
          ],
        ),
        const SizedBox(height: 8),
        ScannerWidget(onScan: _onScan, label: 'Continuous verification scanner active'),
      ],
    );
  }

  Widget _buildScannedList() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppTheme.surface.withAlpha(100), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('VERIFIED ITEMS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textDim)),
              Text('${_scannedSerials.length} UNITS', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.blue)),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 140,
            child: _scannedSerials.isEmpty 
              ? const Center(child: Text('No items verified yet', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic)))
              : ListView.separated(
                  controller: _chipScrollController,
                  itemCount: _scannedSerials.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final s = _scannedSerials.reversed.toList()[i];
                    return SerialChip(serial: s, onDelete: () => setState(() => _scannedSerials.remove(s)));
                  },
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildFixedBottom() {
    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        height: 120,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: AppTheme.darkBg, border: Border(top: BorderSide(color: AppTheme.border))),
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
          onPressed: _handleConfirmDispatch,
          child: const Text('🚀 CONFIRM DISPATCH'),
        ),
      ),
    );
  }

  void _handleConfirmDispatch() {
    if (!_formKey.currentState!.validate()) return;
    if (_scannedSerials.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('⚠️ Scan items first'), backgroundColor: AppTheme.red));
      return;
    }

    final authState = context.read<AuthBloc>().state;
    final staffId = authState is AuthAuthenticated ? authState.userId : 'STAFF';

    final batch = OutwardBatch(
      date: DateFormat('yyyy-MM-dd').format(_selectedDate),
      challanNo: _challanController.text.trim(),
      buyerName: _buyerController.text.trim(),
      saleType: _selectedSaleType,
      staffId: staffId,
      serialNos: _scannedSerials.toList(),
    );

    context.read<OutwardBloc>().add(OutwardSaveRequested(batch));
  }

  void _showErrorDialog(String title, String msg) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.red)),
        content: Text(msg),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
      ),
    );
  }

  void _showSaveSuccess(String id) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('✓ Dispatch Confirmed', style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.green)),
        content: const Text('The outbound entry has been recorded and inventory updated across all terminals.'),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.push('/challan/$id');
            },
            child: const Text('VIEW CHALLAN'),
          ),
        ],
      ),
    );
  }
}
