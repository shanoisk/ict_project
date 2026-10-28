import { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Plus, Search, SlidersHorizontal, Clapperboard, Clock3, Star, Trash2, Pencil, Sparkles, ChevronLeft, ChevronRight, X, Check, PlayCircle, BarChart3, CalendarDays } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const GENRES = ['Action','Comedy','Drama','Horror','Sci-Fi','Romance','Thriller'];
const PLATFORMS = ['Netflix','Prime Video','Hotstar','Theatre','Other'];
const STATUSES = ['To Watch','Watching','Watched'];
const blank = { title:'', genre:'Action', releaseYear:String(new Date().getFullYear()), runtime:'120', platform:'Netflix', priority:'3' };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
    ...options
  });
  const json = await response.json().catch(() => ({ success:false, message:'Invalid server response.' }));
  if (!response.ok || !json.success) throw new Error(json.message || 'Request failed.');
  return json.data;
}
const fmtDate = value => value ? new Date(value).toLocaleDateString() : '—';

function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page:1, totalPages:1, total:0 });
  const [filters, setFilters] = useState({ status:'', genre:'', search:'' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [nextMovie, setNextMovie] = useState(null);
  const [ratingPrompt, setRatingPrompt] = useState(null);
  const [ratingValue, setRatingValue] = useState('8');
  const [showRatingEditor, setShowRatingEditor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page:String(page) });
      if (filters.status) params.set('status', filters.status);
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.search.trim()) params.set('search', filters.search.trim());
      const [movieData, statData] = await Promise.all([request(`/movies?${params}`), request('/stats')]);
      setMovies(movieData.movies); setPagination(movieData.pagination); setStats(statData);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(t); } }, [notice]);

  const openAdd = () => { setEditing(null); setForm(blank); setError(''); setFormOpen(true); };
  const openEdit = movie => {
    setEditing(movie); setForm({ title:movie.title, genre:movie.genre, releaseYear:String(movie.releaseYear), runtime:String(movie.runtime), platform:movie.platform, priority:String(movie.priority) }); setError(''); setFormOpen(true);
  };
  const submitMovie = async e => {
    e.preventDefault(); setError('');
    const year = Number(form.releaseYear), runtime = Number(form.runtime), priority = Number(form.priority);
    if (!form.title.trim()) return setError('Title is required.');
    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()) return setError(`Release year must be between 1950 and ${new Date().getFullYear()}.`);
    if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) return setError('Runtime must be between 30 and 300 minutes.');
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) return setError('Priority must be from 1 to 5.');
    setSaving(true);
    try {
      const payload = { title:form.title.trim(), genre:form.genre, releaseYear:year, runtime, platform:form.platform, priority };
      if (editing) await request(`/movies/${editing._id}`, { method:'PUT', body:JSON.stringify(payload) });
      else await request('/movies', { method:'POST', body:JSON.stringify(payload) });
      setFormOpen(false); setNotice(editing ? 'Movie updated successfully.' : 'Movie added to your watchlist.'); setPage(1); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const changeStatus = async (movie, status, rating) => {
    try {
      await request(`/movies/${movie._id}/status`, { method:'PATCH', body:JSON.stringify({ status, ...(status === 'Watched' ? { rating:Number(rating) } : {}) }) });
      setRatingPrompt(null); setNotice(`Status changed to ${status}.`); await load();
    } catch (e) { setError(e.message); }
  };
  const askStatus = (movie, status) => {
    if (status === 'Watched') { setRatingValue(movie.rating ? String(movie.rating) : '8'); setRatingPrompt({ movie, status }); }
    else changeStatus(movie, status);
  };
  const deleteMovie = async movie => {
    if (movie.status === 'Watching') return;
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) return;
    try { await request(`/movies/${movie._id}`, { method:'DELETE' }); setNotice('Movie deleted.'); await load(); }
    catch (e) { setError(e.message); }
  };
  const updateRating = async movie => {
    try { await request(`/movies/${movie._id}/rating`, { method:'PATCH', body:JSON.stringify({ rating:Number(ratingValue) }) }); setShowRatingEditor(null); setNotice('Rating updated.'); await load(); }
    catch (e) { setError(e.message); }
  };
  const watchNext = async () => {
    setError('');
    try { setNextMovie(await request('/movies/watch-next')); }
    catch (e) { setNextMovie(null); setError(e.message); }
  };
  const visibleStatus = movie => movie.status === 'To Watch' ? ['Watching','Watched'] : movie.status === 'Watching' ? ['Watched','To Watch'] : [];

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><Film size={21}/></span><span>Cine<span className="brand-accent">List</span><small>YOUR PERSONAL MOVIE MANAGER</small></span></a>
      <div className="topbar-right"><span className="live-dot"/> WATCHLIST WORKSPACE <span className="avatar">C</span></div>
    </header>
    <main className="container">
      <section className="hero">
        <div><div className="eyebrow"><span/> YOUR NEXT FAVORITE STARTS HERE</div><h1>Your movie life,<br/><span>beautifully organized.</span></h1><p>Keep track of the stories you want to see, the ones you're watching, and the ones you'll never forget.</p>
          <div className="hero-actions"><button className="btn btn-primary" onClick={openAdd}><Plus size={17}/> Add a movie</button><button className="btn btn-secondary" onClick={watchNext}><Sparkles size={17}/> What should I watch next?</button></div>
        </div>
        <div className="hero-art"><div className="poster poster-back"><span>THE</span><b>UNKNOWN</b><small>A STORY UNFOLDS</small></div><div className="poster poster-front"><div className="poster-sun"/><span>TONIGHT'S</span><b>FEATURE</b><small>YOUR NEXT ADVENTURE</small><div className="poster-line"/></div><div className="floating-tag"><Sparkles size={15}/> Curated for you</div></div>
      </section>

      {stats && <section className="stats-grid">
        <StatCard icon={<Clapperboard/>} label="IN YOUR COLLECTION" value={stats.statusCounts['To Watch'] + stats.statusCounts.Watching + stats.statusCounts.Watched} foot={`${stats.statusCounts['To Watch']} movies waiting`} tone="violet"/>
        <StatCard icon={<PlayCircle/>} label="IN PROGRESS" value={stats.statusCounts.Watching} foot="Currently watching" tone="blue"/>
        <StatCard icon={<Clock3/>} label="HOURS WATCHED" value={stats.totalHoursWatched} foot="Time well spent" tone="orange"/>
        <StatCard icon={<Star/>} label="AVERAGE RATING" value={stats.averageRating == null ? '—' : `${stats.averageRating}/10`} foot={stats.topWatchedGenre ? `Top genre: ${stats.topWatchedGenre.genre}` : 'Rate your watched movies'} tone="green"/>
      </section>}

      {nextMovie && <section className="next-banner"><div className="next-icon"><Sparkles/></div><div className="next-copy"><span>YOUR NEXT PICK</span><h3>{nextMovie.title} <small>{nextMovie.releaseYear}</small></h3><p>{nextMovie.genre} · {nextMovie.runtime} min · Priority {nextMovie.priority}/5 · {nextMovie.platform}</p></div><button className="icon-button" onClick={() => setNextMovie(null)} aria-label="Close"><X size={18}/></button></section>}

      <section className="library-section">
        <div className="section-heading"><div><div className="eyebrow muted">THE COLLECTION</div><h2>Your watchlist<span className="count-pill">{pagination.total}</span></h2><p>Every story has its place. Find yours.</p></div><button className="btn btn-primary" onClick={openAdd}><Plus size={17}/> Add movie</button></div>
        <div className="toolbar"><div className="searchbox"><Search size={17}/><input aria-label="Search by title" placeholder="Search movies by title..." value={filters.search} onChange={e => { setFilters(f => ({...f, search:e.target.value})); setPage(1); }}/>{filters.search && <button onClick={() => setFilters(f => ({...f,search:''}))} aria-label="Clear search"><X size={14}/></button>}</div><div className="filter-label"><SlidersHorizontal size={15}/> FILTER BY</div><select aria-label="Filter status" value={filters.status} onChange={e => {setFilters(f=>({...f,status:e.target.value}));setPage(1);}}><option value="">All statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select><select aria-label="Filter genre" value={filters.genre} onChange={e => {setFilters(f=>({...f,genre:e.target.value}));setPage(1);}}><option value="">All genres</option>{GENRES.map(g=><option key={g}>{g}</option>)}</select></div>

        {error && <div className="alert error-alert"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
        {notice && <div className="alert success-alert"><Check size={16}/>{notice}</div>}
        {loading ? <div className="loading"><span className="spinner"/> Loading your collection...</div> : movies.length === 0 ? <div className="empty-state"><div className="empty-icon"><Film size={28}/></div><h3>No movies found</h3><p>{filters.search || filters.status || filters.genre ? 'Try adjusting your filters or search.' : 'Your watchlist is a blank canvas. Add your first movie.'}</p><button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add your first movie</button></div> : <div className="movie-grid">
          {movies.map(movie => <article className="movie-card" key={movie._id}>
            <div className={`card-art art-${(movie.genre || 'action').toLowerCase().replace(/[^a-z]/g,'')}`}><div className="art-top"><span className="movie-code">{movie.movieCode}</span><span className={`status-badge status-${movie.status.toLowerCase().replace(' ','-')}`}>{movie.status}</span></div><div className="art-center"><Film size={31}/><span>{movie.genre.toUpperCase()}</span></div><div className="art-bottom"><span>{movie.releaseYear}</span><span><Clock3 size={13}/> {movie.runtime} min</span></div></div>
            <div className="movie-card-body"><div className="movie-title-row"><h3 title={movie.title}>{movie.title}</h3><span className="priority" title={`Priority ${movie.priority} out of 5`}>{'★'.repeat(movie.priority)}<span>{'★'.repeat(5-movie.priority)}</span></span></div><div className="movie-meta"><span>{movie.platform}</span><span className="dot-sep"/> <span>{movie.genre}</span></div>
              <div className="movie-footer">{movie.status === 'Watched' ? <button className="rating-chip" onClick={() => {setRatingValue(String(movie.rating || 8));setShowRatingEditor(movie._id);}}><Star size={14} fill="currentColor"/> {movie.rating}/10 <small>· Edit rating</small></button> : <span className="priority-label">Priority <b>{movie.priority}/5</b></span>}<div className="card-actions"><button className="icon-button" onClick={() => openEdit(movie)} title="Edit movie" aria-label="Edit movie"><Pencil size={15}/></button><button className="icon-button danger" disabled={movie.status === 'Watching'} onClick={() => deleteMovie(movie)} title={movie.status === 'Watching' ? 'Watching movies cannot be deleted' : 'Delete movie'} aria-label="Delete movie"><Trash2 size={15}/></button></div></div>
              {movie.status !== 'Watched' && <div className="status-control"><label htmlFor={`status-${movie._id}`}>Update status</label><select id={`status-${movie._id}`} value="" onChange={e => e.target.value && askStatus(movie,e.target.value)}><option value="">Choose next status…</option>{visibleStatus(movie).map(s=><option key={s}>{s}</option>)}</select></div>}
              {movie.status === 'Watched' && <div className="watched-date"><CalendarDays size={13}/> Watched {fmtDate(movie.watchedDate)}</div>}
              {showRatingEditor === movie._id && <div className="inline-rating"><select value={ratingValue} onChange={e=>setRatingValue(e.target.value)}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select><button className="mini-save" onClick={()=>updateRating(movie)}>Save</button><button className="mini-cancel" onClick={()=>setShowRatingEditor(null)}>Cancel</button></div>}
            </div>
          </article>)}
        </div>}
        {!loading && pagination.totalPages > 1 && <div className="pagination"><span>Showing <b>{(page-1)*6+1}–{Math.min(page*6,pagination.total)}</b> of <b>{pagination.total}</b> movies</span><div><button className="page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)} aria-label="Previous page"><ChevronLeft size={17}/></button><span className="page-number">{page} <small>of</small> {pagination.totalPages}</span><button className="page-btn" disabled={page>=pagination.totalPages} onClick={()=>setPage(p=>p+1)} aria-label="Next page"><ChevronRight size={17}/></button></div></div>}
      </section>
      <footer><div className="footer-brand"><Film size={16}/> CineList</div><span>Made for movie lovers. One story at a time.</span><span className="footer-status"><span/> Connected workspace</span></footer>
    </main>

    {formOpen && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget && setFormOpen(false)}><div className="modal"><div className="modal-heading"><div><span className="eyebrow muted">{editing ? 'REFINE YOUR COLLECTION' : 'MAKE IT A MOVIE NIGHT'}</span><h2>{editing ? 'Edit movie' : 'Add a movie'}</h2><p>{editing ? 'Update the details of this movie.' : 'Add a title to your personal watchlist.'}</p></div><button className="icon-button" onClick={()=>setFormOpen(false)} aria-label="Close"><X/></button></div>
      {error && <div className="alert error-alert">{error}</div>}
      <form className="movie-form" onSubmit={submitMovie}>
        <div className="field full"><label>Movie title *</label><input autoFocus maxLength="120" placeholder="e.g. Interstellar" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/></div>
        <div className="field"><label>Genre *</label><select value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))}>{GENRES.map(g=><option key={g}>{g}</option>)}</select></div>
        <div className="field"><label>Release year *</label><input type="number" min="1950" max={new Date().getFullYear()} value={form.releaseYear} onChange={e=>setForm(f=>({...f,releaseYear:e.target.value}))} required disabled={!!editing}/>{editing && <small>Release year cannot be changed.</small>}</div>
        <div className="field"><label>Runtime (minutes) *</label><input type="number" min="30" max="300" value={form.runtime} onChange={e=>setForm(f=>({...f,runtime:e.target.value}))} required/></div>
        <div className="field"><label>Streaming platform *</label><select value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="field full"><div className="priority-heading"><label>Watch priority *</label><span>{form.priority} / 5</span></div><div className="priority-picker">{[1,2,3,4,5].map(n=><button type="button" key={n} className={Number(form.priority)>=n?'selected':''} onClick={()=>setForm(f=>({...f,priority:String(n)}))} aria-label={`Priority ${n}`}><Star size={22} fill={Number(form.priority)>=n?'currentColor':'none'}/></button>)}</div><small>5 means “watch this first”.</small></div>
        <div className="form-note full"><Sparkles size={15}/><span>Movie code is generated automatically. New movies start in <b>To Watch</b>.</span></div>
        <div className="modal-actions full"><button type="button" className="btn btn-secondary" onClick={()=>setFormOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':<>{editing?'Save changes':<><Plus size={16}/> Add to watchlist</>}</>}</button></div>
      </form></div></div>}

    {ratingPrompt && <div className="modal-backdrop"><div className="modal rating-modal"><div className="modal-heading"><div><span className="eyebrow muted">ONE LAST THING</span><h2>How was the movie?</h2><p>Give <b>{ratingPrompt.movie.title}</b> a rating to mark it as Watched.</p></div><button className="icon-button" onClick={()=>setRatingPrompt(null)} aria-label="Close"><X/></button></div><div className="rating-big"><Star size={27} fill="currentColor"/><strong>{ratingValue}</strong><span>/ 10</span></div><input className="rating-range" type="range" min="1" max="10" value={ratingValue} onChange={e=>setRatingValue(e.target.value)}/><div className="range-labels"><span>Not for me</span><span>A masterpiece</span></div><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setRatingPrompt(null)}>Cancel</button><button className="btn btn-primary" onClick={()=>changeStatus(ratingPrompt.movie,'Watched',ratingValue)}><Check size={16}/> Save rating & finish</button></div></div></div>}
  </div>;
}

function StatCard({icon,label,value,foot,tone}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}
export default App;
