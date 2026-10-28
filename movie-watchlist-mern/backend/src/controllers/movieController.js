import Movie from '../models/Movie.js';
import YearSequence from '../models/YearSequence.js';
import { send } from '../utils/response.js';

const genres = ['Action','Comedy','Drama','Horror','Sci-Fi','Romance','Thriller'];
const platforms = ['Netflix','Prime Video','Hotstar','Theatre','Other'];
const currentYear = () => new Date().getFullYear();
const validRating = (n) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 10;

function validateMovie(body, partial = false) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('Title is required.');
    else if (body.title.trim().length > 120) errors.push('Title must be 120 characters or fewer.');
  }
  if (!partial || body.genre !== undefined) if (!genres.includes(body.genre)) errors.push('Choose a valid genre.');
  if (!partial || body.releaseYear !== undefined) {
    const year = Number(body.releaseYear);
    if (!Number.isInteger(year) || year < 1950 || year > currentYear()) errors.push(`Release year must be between 1950 and ${currentYear()}.`);
  }
  if (!partial || body.runtime !== undefined) {
    const runtime = Number(body.runtime);
    if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) errors.push('Runtime must be an integer between 30 and 300 minutes.');
  }
  if (!partial || body.platform !== undefined) if (!platforms.includes(body.platform)) errors.push('Choose a valid platform.');
  if (!partial || body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isInteger(p) || p < 1 || p > 5) errors.push('Priority must be an integer from 1 to 5.');
  }
  return errors;
}

export async function listMovies(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 6;
    const filter = {};
    if (req.query.status && ['To Watch','Watching','Watched'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.genre && genres.includes(req.query.genre)) filter.genre = req.query.genre;
    if (req.query.search) filter.title = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const total = await Movie.countDocuments(filter);
    const movies = await Movie.find(filter)
      .sort({ status: 1, priority: -1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean();
    // Ensure To Watch movies are ordered by priority, while preserving sensible ordering for other statuses.
    movies.sort((a, b) => {
      if (a.status === 'To Watch' && b.status !== 'To Watch') return -1;
      if (b.status === 'To Watch' && a.status !== 'To Watch') return 1;
      if (a.status === 'To Watch' && b.status === 'To Watch') return b.priority - a.priority || a.runtime - b.runtime;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return send(res, 200, 'Movies fetched successfully.', { movies, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
}

export async function getMovie(req, res, next) {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, 'Movie not found.');
    return send(res, 200, 'Movie fetched successfully.', movie);
  } catch (e) { next(e); }
}

export async function createMovie(req, res, next) {
  try {
    const errors = validateMovie(req.body);
    if (errors.length) return send(res, 400, errors.join(' '));
    const title = req.body.title.trim();
    const releaseYear = Number(req.body.releaseYear);
    const duplicate = await Movie.findOne({ titleKey: title.toLowerCase(), releaseYear });
    if (duplicate) return send(res, 409, 'A movie with this title and release year already exists.');
    const counter = await YearSequence.findByIdAndUpdate(
      releaseYear, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (counter.seq > 999) return send(res, 400, 'The movie code sequence for this release year has reached its limit.');
    const movieCode = `MV-${releaseYear}-${String(counter.seq).padStart(3, '0')}`;
    const movie = await Movie.create({
      movieCode, title, titleKey: title.toLowerCase(), genre: req.body.genre,
      releaseYear, runtime: Number(req.body.runtime), platform: req.body.platform,
      priority: Number(req.body.priority), status: 'To Watch', rating: null, watchedDate: null
    });
    return send(res, 201, 'Movie added successfully.', movie);
  } catch (e) { next(e); }
}

export async function updateMovie(req, res, next) {
  try {
    const forbidden = ['movieCode','releaseYear','status','rating','watchedDate','titleKey'];
    if (forbidden.some(k => Object.hasOwn(req.body, k))) return send(res, 400, 'Movie Code, Release Year, status and rating cannot be edited through this endpoint.');
    const errors = validateMovie(req.body, true);
    if (errors.length) return send(res, 400, errors.join(' '));
    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, 'Movie not found.');
    const updates = {};
    for (const key of ['title','genre','runtime','platform','priority']) {
      if (req.body[key] !== undefined) updates[key] = key === 'title' ? req.body[key].trim() : (['runtime','priority'].includes(key) ? Number(req.body[key]) : req.body[key]);
    }
    const nextTitle = updates.title ?? movie.title;
    const duplicate = await Movie.findOne({ _id: { $ne: movie._id }, titleKey: nextTitle.toLowerCase(), releaseYear: movie.releaseYear });
    if (duplicate) return send(res, 409, 'A movie with this title and release year already exists.');
    if (updates.title) updates.titleKey = updates.title.toLowerCase();
    Object.assign(movie, updates);
    await movie.save();
    return send(res, 200, 'Movie updated successfully.', movie);
  } catch (e) { next(e); }
}

export async function changeStatus(req, res, next) {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, 'Movie not found.');
    const target = req.body.status;
    const transitions = {
      'To Watch': ['Watching','Watched'],
      'Watching': ['Watched','To Watch'],
      'Watched': []
    };
    if (!transitions[movie.status].includes(target)) return send(res, 400, `Invalid status transition: ${movie.status} cannot change to ${target || 'that status'}.`);
    if (target === 'Watched' && !validRating(req.body.rating)) return send(res, 400, 'A rating from 1 to 10 is required when marking a movie as Watched.');
    movie.status = target;
    if (target === 'Watched') {
      movie.rating = Number(req.body.rating);
      movie.watchedDate = new Date();
    } else {
      movie.rating = null;
      movie.watchedDate = null;
    }
    await movie.save();
    return send(res, 200, 'Movie status updated successfully.', movie);
  } catch (e) { next(e); }
}

export async function updateRating(req, res, next) {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, 'Movie not found.');
    if (movie.status !== 'Watched') return send(res, 400, 'Rating can be edited only for movies with Watched status.');
    if (!validRating(req.body.rating)) return send(res, 400, 'Rating must be an integer from 1 to 10.');
    movie.rating = Number(req.body.rating);
    await movie.save();
    return send(res, 200, 'Rating updated successfully.', movie);
  } catch (e) { next(e); }
}

export async function deleteMovie(req, res, next) {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, 'Movie not found.');
    if (movie.status === 'Watching') return send(res, 400, 'Movies currently Watching cannot be deleted.');
    await movie.deleteOne();
    return send(res, 200, 'Movie deleted successfully.', { id: req.params.id });
  } catch (e) { next(e); }
}

export async function watchNext(_req, res, next) {
  try {
    const movie = await Movie.findOne({ status: 'To Watch' }).sort({ priority: -1, runtime: 1, createdAt: 1 });
    if (!movie) return send(res, 404, 'No movies are currently in To Watch status.');
    return send(res, 200, 'Here is what you should watch next.', movie);
  } catch (e) { next(e); }
}
