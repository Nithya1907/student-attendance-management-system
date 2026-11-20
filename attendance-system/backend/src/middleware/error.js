class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ message: 'Route not found' });

// Centralized error handler: never leaks SQL/stack details to the client
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with these details already exists' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'Cannot delete: record is referenced by other data' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'Referenced record does not exist' });
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
