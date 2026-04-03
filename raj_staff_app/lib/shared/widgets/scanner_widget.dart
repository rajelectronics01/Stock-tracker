import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import '../../core/theme.dart';

class ScannerWidget extends StatefulWidget {
  final Function(String) onScan;
  final String label;

  const ScannerWidget({
    super.key,
    required this.onScan,
    this.label = 'Position barcode within the frame',
  });

  @override
  State<ScannerWidget> createState() => _ScannerWidgetState();
}

class _ScannerWidgetState extends State<ScannerWidget> {
  final MobileScannerController controller = MobileScannerController(
    formats: [BarcodeFormat.all],
    detectionSpeed: DetectionSpeed.unrestricted,
    facing: CameraFacing.back,
  );

  bool _isScanCoolingDown = false;

  void _handleCapture(BarcodeCapture capture) {
    if (_isScanCoolingDown) return;

    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final String? code = barcode.rawValue;
      if (code != null) {
        _vibrate();
        widget.onScan(code);
        
        setState(() => _isScanCoolingDown = true);
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) setState(() => _isScanCoolingDown = false);
        });
        break;
      }
    }
  }

  void _vibrate() async {
    try {
      if (await Vibration.hasVibrator()) {
        Vibration.vibrate(duration: 50);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 250,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.border, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: _handleCapture,
          ),
          _buildOverlay(),
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Text(
              widget.label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverlay() {
    return Stack(
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.black.withAlpha(100),
          ),
        ),
        Center(
          child: Container(
            width: 200,
            height: 120,
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.blue, width: 2),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        Center(
          child: Container(
            height: 1,
            width: 180,
            color: AppTheme.blue.withAlpha(150),
          ),
        ),
      ],
    );
  }
}
