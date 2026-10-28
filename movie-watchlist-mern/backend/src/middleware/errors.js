import { send } from '../utils/response.js';
export function notFound(req, res) {
  return send(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}
export function errorHandler(err, _req, res, _next) {
  if (err?.code === 11000) {
    return send(res, 409, 'A movie with this title and release year already exists.');
  }
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    return send(res, 400, err.message);
  }
  console.error(err);
  return send(res, err.status || 500, err.message || 'Internal server error');
}
