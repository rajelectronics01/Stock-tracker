import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme.dart';
import '../../../shared/widgets/scanner_widget.dart';
import '../../../shared/widgets/serial_chip.dart';
import '../bloc/inward_bloc.dart';
import '../../../shared/models/inward_batch.dart';
import '../../auth/bloc/auth_bloc.dart';

class InwardScreen extends StatefulWidget {
  const InwardScreen({super.key});

  @override
  State<InwardScreen> createState() => _InwardScreenState();
}

class _InwardScreenState extends State<InwardScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _brandController = TextEditingController();
  final TextEditingController _modelController = TextEditingController();
  String _selectedGodown = 'Main Godown';
  DateTime _selectedDate = DateTime.now();
  final List<String> _scannedSerials = [];
  final ScrollController _chipScrollController = ScrollController();

  final List<String> _godowns = ['Main Godown', 'Godown 2', 'Service Center'];

  @override
  void initState() {
    super.initState();
    context.read<InwardBloc>().add(InwardLoadConfig());
  }

  void _onScan(String serial) {
    if (_scannedSerials.contains(serial)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⚠️ Already scanned'), backgroundColor: AppTheme.amber),
      );
      return;
    }
    setState(() => _scannedSerials.add(serial));
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('📥 Inward Stock Entry', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        actions: [
          IconButton(onPressed: () => context.go('/outward'), icon: const Icon(Icons.outbound, color: AppTheme.blue)),
          IconButton(onPressed: () => context.go('/login'), icon: const Icon(Icons.logout, color: AppTheme.red)),
        ],
      ),
      body: BlocConsumer<InwardBloc, InwardState>(
        listener: (context, state) {
          if (state is InwardSaveSuccess) {
            _showSuccessDialog('✓ Saved ${state.count} items');
          } else if (state is InwardError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message), backgroundColor: AppTheme.red));
          }
        },
        builder: (context, state) {
          return Stack(
            children: [
              SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: 150, top: 16, left: 16, right: 16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (state is InwardConfigLoaded)
                         _buildFormHeader(state.godowns)
                      else
                         _buildFormHeader(_godowns),
                      const SizedBox(height: 16),
                      const Text('📷 CONTINUOUS SCANNER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.textDim, letterSpacing: 1.2)),
                      const SizedBox(height: 8),
                      ScannerWidget(
                        onScan: _onScan,
                        label: 'Scan linear barcode on packaging',
                      ),
                      const SizedBox(height: 16),
                      _buildScannedList(),
                    ],
                  ),
                ),
              ),
              if (state is InwardLoading)
                 const Positioned(bottom: 50, right: 50, child: CircularProgressIndicator())
              else
                 _buildSaveButton(),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFormHeader(List<String> godowns) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context, 
                      initialDate: _selectedDate, 
                      firstDate: DateTime(2020), 
                      lastDate: DateTime(2030)
                    );
                    if (d != null) setState(() => _selectedDate = d);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Entry Date'),
                    child: Text(DateFormat('dd MMM yyyy').format(_selectedDate)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedGodown,
                  decoration: const InputDecoration(labelText: 'Godown'),
                  items: godowns.map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _selectedGodown = v);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _brandController,
            decoration: const InputDecoration(labelText: 'Brand (e.g. Samsung, LG)'),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _modelController,
            decoration: const InputDecoration(labelText: 'Model Name / Number'),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
        ],
      ),
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
              const Text('SCANNED UNITS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textDim)),
              Text('${_scannedSerials.length} ITEMS', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.blue)),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 140,
            child: _scannedSerials.isEmpty 
              ? const Center(child: Text('No units scanned yet', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic)))
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

  Widget _buildSaveButton() {
    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        height: 120,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: AppTheme.darkBg, border: Border(top: BorderSide(color: AppTheme.border))),
        child: ElevatedButton(
          onPressed: _handleSave,
          child: const Text('💾 SAVE INWARD ENTRY', style: TextStyle(letterSpacing: 1)),
        ),
      ),
    );
  }

  void _handleSave() {
    if (!_formKey.currentState!.validate()) return;
    if (_scannedSerials.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('⚠️ Scan at least one item'), backgroundColor: AppTheme.red));
      return;
    }
    
    final authState = context.read<AuthBloc>().state;
    final staffId = authState is AuthAuthenticated ? authState.userId : 'STAFF';
    
    final batch = InwardBatch(
      date: DateFormat('yyyy-MM-dd').format(_selectedDate),
      godown: _selectedGodown,
      brand: _brandController.text.trim(),
      model: _modelController.text.trim(),
      staffId: staffId,
      serialNos: _scannedSerials.toList(),
    );
    context.read<InwardBloc>().add(InwardSaveRequested(batch));
  }

  void _showSuccessDialog(String msg) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('✓ Stock Saved', style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.green)),
        content: Text(msg),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _scannedSerials.clear();
                _brandController.clear();
                _modelController.clear();
              });
            },
            child: const Text('DONE', style: TextStyle(letterSpacing: 1)),
          ),
        ],
      ),
    );
  }
}
