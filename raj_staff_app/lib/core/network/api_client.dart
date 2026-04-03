import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../constants.dart';

class ApiClient {
  final Dio dio;
  final SecureStorage secureStorage;

  ApiClient(this.dio, this.secureStorage) {
    dio.options.baseUrl = ApiConstants.baseUrl;
    dio.options.connectTimeout = const Duration(seconds: 15);
    dio.options.receiveTimeout = const Duration(seconds: 15);
    
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await secureStorage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          // Custom error mapping for user-friendly messages
          String message = 'Something went wrong';
          if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.sendTimeout) {
            message = 'Connection timed out. Check your internet.';
          } else if (e.response != null) {
            message = e.response?.data['error'] ?? e.response?.data['message'] ?? 'Server error';
          }
          final error = DioException(
            requestOptions: e.requestOptions,
            error: message,
            message: message,
            response: e.response,
            type: e.type,
          );
          return handler.next(error);
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? query}) => 
    dio.get(path, queryParameters: query);

  Future<Response> post(String path, {dynamic data}) => 
    dio.post(path, data: data);
}
