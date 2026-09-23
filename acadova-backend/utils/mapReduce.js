// Practical MapReduce simulation (MAP -> GROUP/SHUFFLE -> REDUCE) used for
// Subject Demand Frequency analytics. No Hadoop/Spark involved on purpose -
// this exists to demonstrate the concept using plain JavaScript over data
// already in memory (or paged from MongoDB).

// MAP STAGE
// Convert each session's subject into a ("subject", 1) pair.
function mapSessions(sessions) {
  return sessions.map((session) => [session.subject, 1]);
}

// GROUP STAGE
// Group identical keys together, e.g. "Java" -> [1, 1, 1].
function groupMappedResults(mappedPairs) {
  const groups = {};
  for (const [key, value] of mappedPairs) {
    if (!groups[key]) groups[key] = [];
    groups[key].push(value);
  }
  return groups;
}

// REDUCE STAGE
// Sum the values for each key, e.g. "Java" -> 3.
function reduceGroupedResults(groupedResults) {
  const totals = {};
  for (const key of Object.keys(groupedResults)) {
    totals[key] = groupedResults[key].reduce((sum, value) => sum + value, 0);
  }
  return totals;
}

// Convenience wrapper that runs all three stages and returns a sorted array,
// which is what the analytics endpoint actually serves.
function runSubjectDemandMapReduce(sessions) {
  const mapped = mapSessions(sessions);
  const grouped = groupMappedResults(mapped);
  const reduced = reduceGroupedResults(grouped);

  return Object.entries(reduced)
    .map(([subject, requestCount]) => ({ subject, requestCount }))
    .sort((a, b) => b.requestCount - a.requestCount);
}

module.exports = {
  mapSessions,
  groupMappedResults,
  reduceGroupedResults,
  runSubjectDemandMapReduce,
};
