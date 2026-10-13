const { InvalidInput, validateQuery } = require('../middleware/validation');
const DAY = 86400000;
function calendarDate(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InvalidInput('Use YYYY-MM-DD dates.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new InvalidInput('Use a valid calendar date.');
  return value;
}
const query = validateQuery({ from: calendarDate, to: calendarDate });
function analyticsWindow(req, res, next) {
  query(req, res, () => {
    const { from, to } = req.validatedQuery;
    if (Boolean(from) !== Boolean(to)) return res.status(400).json({ success: false, message: 'Supply both From and To dates.' });
    if (from) {
      const start = new Date(from + 'T00:00:00.000Z');
      const end = new Date(to + 'T00:00:00.000Z');
      if (end < start || end - start >= 366 * DAY) return res.status(400).json({ success: false, message: 'Choose an ordered range of at most 366 days.' });
      req.analyticsWindow = { start, end: new Date(end.getTime() + DAY) };
    }
    next();
  });
}
const dateMatch = (req, field) => req.analyticsWindow
  ? { [field]: { $gte: req.analyticsWindow.start, $lt: req.analyticsWindow.end } } : {};
// Aggregate in MongoDB, return only bounded summaries, and cap query execution.
const aggregate = (model, pipeline) => {
  const query = model.aggregate(pipeline);
  return typeof query.option === 'function' ? query.option({ maxTimeMS: 8000 }) : query;
};
module.exports = { calendarDate, analyticsWindow, dateMatch, aggregate };
