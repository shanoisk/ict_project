import Movie from '../models/Movie.js';
import { send } from '../utils/response.js';

export async function getStats(_req, res, next) {
  try {
    const [statuses, watched] = await Promise.all([
      Movie.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Movie.aggregate([
        { $match: { status: 'Watched' } },
        { $group: { _id: null, totalRuntime: { $sum: '$runtime' }, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
    ]);
    const genreCounts = await Movie.aggregate([
      { $match: { status: 'Watched' } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 }
    ]);
    const statusCounts = { 'To Watch': 0, Watching: 0, Watched: 0 };
    statuses.forEach(s => { statusCounts[s._id] = s.count; });
    const w = watched[0] || { totalRuntime: 0, averageRating: null, count: 0 };
    return send(res, 200, 'Statistics fetched successfully.', {
      statusCounts,
      totalHoursWatched: Math.round((w.totalRuntime / 60) * 10) / 10,
      averageRating: w.averageRating == null ? null : Math.round(w.averageRating * 10) / 10,
      topWatchedGenre: genreCounts[0] ? { genre: genreCounts[0]._id, count: genreCounts[0].count } : null
    });
  } catch (e) { next(e); }
}
