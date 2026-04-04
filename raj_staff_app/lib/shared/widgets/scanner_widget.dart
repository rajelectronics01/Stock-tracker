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
    this.label = 'Scan linear barcode on packaging',
  });

  @override
  State<ScannerWidget> createState() => _ScannerWidgetState();
}

class _ScannerWidgetState extends State<ScannerWidget> {
  // --- ULTIMATE SCANNER SETTINGS ---
  late MobileScannerController controller;

  @override
  void initState() {
    super.initState();
    controller = MobileScannerController(
      // By passing an empty formats array or not providing it, we allow ALL formats
      // including DataMatrix, ITF, Code93, etc. This catches absolutely everything!
      formats: const [BarcodeFormat.all],
      // Unrestricted speed lets the camera read frames as fast as possible.
      // We handle rate limiting manually in _handleCapture.
      detectionSpeed: DetectionSpeed.unrestricted,
      facing: CameraFacing.back,
    );
  }

  String? _lastScannedCode;
  DateTime? _lastScanTime;

  void _handleCapture(BarcodeCapture capture) {
    if (capture.barcodes.isEmpty) return;
    
    // Check all detected barcodes for valid criteria
    for (final barcode in capture.barcodes) {
      final String? code = barcode.rawValue;
      if (code == null || code.isEmpty) continue;

      // --- ROBUST LOGIC FILTER ---
      
      // 1. Minimum character check (reduced to 3 to catch short custom codes)
      if (code.length < 3) continue; 
      
      // 2. Intelligent Duplicate Filter (2.0s delay for the EXACT SAME code)
      // This prevents the "Already Scanned" spam while hovering over the same barcode.
      final now = DateTime.now();
      if (_lastScannedCode == code && 
          _lastScanTime != null && 
          now.difference(_lastScanTime!).inMilliseconds < 2000) {
        continue;
      }

      _lastScannedCode = code;
      _lastScanTime = now;

      _vibrate();
      widget.onScan(code);
      // Once we scan one valid code in this frame, break so we don't scan multiples from the same frame
      break; 
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
            errorBuilder: (context, error, child) {
              return Center(child: Text('Scanner error: ${error.errorCode}', style: const TextStyle(color: Colors.white)));
            },
          ),
          _buildOverlay(),
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              margin: const EdgeInsets.symmetric(horizontal: 40),
              decoration: BoxDecoration(
                color: Colors.black.withAlpha(200),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                widget.label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
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
        ColorFiltered(
          colorFilter: ColorFilter.mode(
            Colors.black.withAlpha(120),
            BlendMode.srcOut,
          ),
          child: Stack(
            children: [
              Container(decoration: const BoxDecoration(color: Colors.black, backgroundBlendMode: BlendMode.dstOut)),
              Center(
                child: Container(
                  width: 300,
                  height: 120, // Wide and short perfect for 1D barcodes
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
        ),
        Center(
          child: Container(
            width: 300,
            height: 120,
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.blue, width: 2),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(color: AppTheme.blue.withAlpha(30), blurRadius: 10, spreadRadius: 2),
              ],
            ),
          ),
        ),
        // Simple Fast Scanning Line
        const ScanAnimateLine(),
      ],
    );
  }
}

class ScanAnimateLine extends StatefulWidget {
  const ScanAnimateLine({super.key});

  @override
  State<ScanAnimateLine> createState() => _ScanAnimateLineState();
}

class _ScanAnimateLineState extends State<ScanAnimateLine> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Positioned(
          top: 70 + (_controller.view.value * 110),
          left: 0, right: 0,
          child: Center(
            child: Container(
              height: 2,
              width: 280,
              decoration: BoxDecoration(
                boxShadow: [BoxShadow(color: AppTheme.blue, blurRadius: 4, spreadRadius: 1)],
                color: AppTheme.blue,
              ),
            ),
          ),
        );
      },
    );
  }
}
