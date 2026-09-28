import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Minus,
  Plus,
  Target,
  Bookmark,
  Search,
  Maximize2,
  Minimize2,
  List,
  Type,
  AlignJustify,
  Star,
  Check,
  Highlighter,
  StickyNote,
  X,
} from 'lucide-react';
import { DashboardTheme } from '../types';
import {
  CAL_NEWPORT_BOOKS,
  CAL_NEWPORT_LIBRARY_UPDATED,
  CalNewportBook,
} from '../data/calNewportLibrary';

type ReaderTone = 'paper' | 'sepia' | 'night';
type ReaderFont = 'serif' | 'sans';
type ReaderWidth = 'narrow' | 'medium' | 'wide';
type HighlightColor = 'yellow' | 'blue' | 'pink' | 'green';
interface ReaderHighlight { id: string; text: string; color: HighlightColor; note: string; sectionId: string; createdAt: string; }

interface CalNewportLibraryProps {
  theme: DashboardTheme;
  onBack: () => void;
}

const ACTIVE_BOOK_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_ACTIVE_BOOK';
const FONT_SCALE_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_FONT_SCALE';
const READER_SETTINGS_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_READER_SETTINGS';
const READER_STATE_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_READER_STATE';

export const CalNewportLibrary: React.FC<CalNewportLibraryProps> = ({
  theme: _theme,
  onBack,
}) => {
  const [activeBookId, setActiveBookId] = useState<CalNewportBook['id']>(() => {
    if (typeof window === 'undefined') return 'so-good';
    const stored = window.localStorage.getItem(ACTIVE_BOOK_KEY);
    return CAL_NEWPORT_BOOKS.some((book) => book.id === stored)
      ? (stored as CalNewportBook['id'])
      : 'so-good';
  });
  const [fontScale, setFontScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const parsed = Number(window.localStorage.getItem(FONT_SCALE_KEY) || '1');
    return Number.isFinite(parsed) ? Math.min(1.25, Math.max(0.9, parsed)) : 1;
  });
  const [readerTone, setReaderTone] = useState<ReaderTone>('paper');
  const [readerFont, setReaderFont] = useState<ReaderFont>('serif');
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('medium');
  const [lineHeight, setLineHeight] = useState(1.9);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isFocusReader, setIsFocusReader] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, ReaderHighlight[]>>({});
  const [pendingSelection, setPendingSelection] = useState<{ text: string; sectionId: string; x: number; y: number } | null>(null);
  const [isHighlightsOpen, setIsHighlightsOpen] = useState(false);
  const [completedBooks, setCompletedBooks] = useState<string[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<string[]>(() => CAL_NEWPORT_BOOKS.filter((book) => book.favorite).map((book) => book.id));

  const activeBook = useMemo(
    () => CAL_NEWPORT_BOOKS.find((book) => book.id === activeBookId) || CAL_NEWPORT_BOOKS[0],
    [activeBookId]
  );

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_BOOK_KEY, activeBookId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeBookId]);

  useEffect(() => {
    window.localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(READER_SETTINGS_KEY) || '{}');
      if (saved.readerTone) setReaderTone(saved.readerTone);
      if (saved.readerFont) setReaderFont(saved.readerFont);
      if (saved.readerWidth) setReaderWidth(saved.readerWidth);
      if (saved.lineHeight) setLineHeight(saved.lineHeight);
      const state = JSON.parse(window.localStorage.getItem(READER_STATE_KEY) || '{}');
      setBookmarks(state.bookmarks || {}); setNotes(state.notes || {});
      const rawHighlights = state.highlights || {};
      const migratedHighlights = Object.fromEntries(Object.entries(rawHighlights).map(([bookId, items]: [string, any]) => [bookId, (Array.isArray(items) ? items : []).map((item: any, index: number) => typeof item === 'string' ? { id: `legacy-${bookId}-${index}`, text: item, color: 'yellow', note: '', sectionId: 'overview', createdAt: new Date().toISOString() } : item)]));
      setHighlights(migratedHighlights);
      setCompletedBooks(state.completedBooks || []); if (state.favoriteBooks) setFavoriteBooks(state.favoriteBooks);
      const y = Number(state.positions?.[activeBookId] || 0); if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ readerTone, readerFont, readerWidth, lineHeight }));
  }, [readerTone, readerFont, readerWidth, lineHeight]);

  useEffect(() => {
    const save = () => {
      let previous: any = {}; try { previous = JSON.parse(window.localStorage.getItem(READER_STATE_KEY) || '{}'); } catch {}
      window.localStorage.setItem(READER_STATE_KEY, JSON.stringify({ ...previous, bookmarks, notes, highlights, completedBooks, favoriteBooks, positions: { ...(previous.positions || {}), [activeBookId]: window.scrollY } }));
    };
    const onScroll = () => save(); window.addEventListener('scroll', onScroll, { passive: true }); save();
    return () => { window.removeEventListener('scroll', onScroll); save(); };
  }, [activeBookId, bookmarks, notes, highlights, completedBooks, favoriteBooks]);

  useEffect(() => {
    const updateProgress = () => {
      const doc = document.documentElement;
      const available = Math.max(1, doc.scrollHeight - window.innerHeight);
      const next = Math.min(100, Math.max(0, (window.scrollY / available) * 100));
      setReadingProgress(next);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [activeBookId]);

  const toneClasses = readerTone === 'night' ? 'bg-[#111315] text-[#ece8df]' : readerTone === 'sepia' ? 'bg-[#f4ecd8] text-[#3f3426]' : 'bg-[#f7f7f7] text-slate-900';
  const cardClasses = readerTone === 'night' ? 'bg-[#191c1f] border-[#2b3035]' : readerTone === 'sepia' ? 'bg-[#fbf4e3] border-[#ded0b4]' : 'bg-white border-slate-200';
  const mutedText = readerTone === 'night' ? 'text-slate-400' : readerTone === 'sepia' ? 'text-[#766653]' : 'text-slate-500';
  const widthClass = readerWidth === 'narrow' ? 'max-w-[680px]' : readerWidth === 'wide' ? 'max-w-[1080px]' : 'max-w-[820px]';
  const fontFamily = readerFont === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Inter, ui-sans-serif, system-ui, sans-serif';
  const currentSections = ['overview', ...activeBook.themes.map((_, i) => `theme-${i}`), 'summary'];
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toggleBookmark = (id: string) => setBookmarks((prev) => ({ ...prev, [activeBookId]: (prev[activeBookId] || []).includes(id) ? (prev[activeBookId] || []).filter((x) => x !== id) : [...(prev[activeBookId] || []), id] }));
  const toggleFavorite = () => setFavoriteBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);
  const toggleComplete = () => setCompletedBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);
  const captureSelection = () => {
    const selection = window.getSelection(); const text = selection?.toString().trim(); if (!selection || !text || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect();
    const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer as Element : range.commonAncestorContainer.parentElement;
    const section = element?.closest('[id^="theme-"], #overview, #summary') as HTMLElement | null;
    setPendingSelection({ text, sectionId: section?.id || 'overview', x: Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2 - 100)), y: rect.bottom + window.scrollY + 8 });
  };
  const createHighlight = (color: HighlightColor) => {
    if (!pendingSelection) return; const item: ReaderHighlight = { id: `hl-${Date.now()}`, text: pendingSelection.text, color, note: '', sectionId: pendingSelection.sectionId, createdAt: new Date().toISOString() };
    setHighlights(prev => ({ ...prev, [activeBookId]: [...(prev[activeBookId] || []), item] })); setPendingSelection(null); window.getSelection()?.removeAllRanges();
  };
  const updateHighlightNote = (id: string, note: string) => setHighlights(prev => ({ ...prev, [activeBookId]: (prev[activeBookId] || []).map(item => item.id === id ? { ...item, note } : item) }));
  const deleteHighlight = (id: string) => setHighlights(prev => ({ ...prev, [activeBookId]: (prev[activeBookId] || []).filter(item => item.id !== id) }));
  const remainingMinutes = Math.max(0, Math.ceil((100 - readingProgress) / 100 * Number(activeBook.readingTime.match(/\d+/)?.[0] || 20)));

  const selectBook = (book: CalNewportBook) => {
    setActiveBookId(book.id);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${toneClasses}`}>
      <div className="fixed top-0 left-0 right-0 z-[70] h-1 bg-black/10">
        <div
          className="h-full bg-blue-600 transition-[width] duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <header className="sticky top-0 z-[60] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="w-full px-3 sm:px-5 lg:px-7 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                readerTone === 'night'
                  ? 'border-[#343a40] hover:bg-white/5'
                  : 'border-black/10 hover:bg-black/5'
              }`}
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h1 className="text-base font-semibold tracking-tight truncate">
                  By Cal Newport
                </h1>
              </div>
              <p className={`text-[11px] sm:text-xs font-semibold ${mutedText}`}>
                Practical reading library • Updated {CAL_NEWPORT_LIBRARY_UPDATED}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setIsTocOpen(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Table of contents"><List className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsSearchOpen(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Search this guide"><Search className="w-4 h-4" /></button>
            <button type="button" onClick={toggleFavorite} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Favorite"><Star className={`w-4 h-4 ${favoriteBooks.includes(activeBookId) ? 'fill-current text-amber-500' : ''}`} /></button>
            <button type="button" onClick={toggleComplete} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Mark complete"><Check className={`w-4 h-4 ${completedBooks.includes(activeBookId) ? 'text-emerald-600' : ''}`} /></button>
            <button type="button" onClick={() => setIsFocusReader(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Distraction-free reading">{isFocusReader ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`hidden sm:flex items-center rounded-xl border p-1 ${
                readerTone === 'night' ? 'border-[#343a40]' : 'border-black/10'
              }`}
            >
              <button
                type="button"
                onClick={() => setFontScale((value) => Math.max(0.9, Number((value - 0.05).toFixed(2))))}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Decrease reading text size"
                title="Decrease text size"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className={`px-1 text-[11px] font-bold ${mutedText}`}>
                Aa
              </span>
              <button
                type="button"
                onClick={() => setFontScale((value) => Math.min(1.25, Number((value + 0.05).toFixed(2))))}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Increase reading text size"
                title="Increase text size"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>

        {!isFocusReader && (isTocOpen || isSearchOpen) && <div className="border-t border-slate-200/70 px-3 sm:px-5 py-3">
          {isSearchOpen && <div className="relative max-w-xl mb-3"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search themes and ideas…" className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-blue-500" /><button onClick={() => {setSearchQuery('');setIsSearchOpen(false)}} className="absolute right-2 top-2 h-5 w-5"><X className="w-4 h-4" /></button></div>}
          {isTocOpen && <div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => jumpTo('overview')} className="px-3 h-8 rounded-lg bg-slate-100 text-xs font-medium">Overview</button>{activeBook.themes.map((t,i)=><button key={t.title} onClick={() => jumpTo(`theme-${i}`)} className="px-3 h-8 rounded-lg bg-slate-100 text-xs font-medium whitespace-nowrap">{t.title}</button>)}<button onClick={() => jumpTo('summary')} className="px-3 h-8 rounded-lg bg-slate-100 text-xs font-medium">Summary</button></div>}
        </div>}

        {!isFocusReader && <div className="w-full px-3 sm:px-5 lg:px-7 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {CAL_NEWPORT_BOOKS.map((book, index) => (
              <button
                key={book.id}
                type="button"
                onClick={() => selectBook(book)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  activeBookId === book.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : readerTone === 'night'
                    ? 'border-[#343a40] hover:bg-white/5'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                {index + 1}. {book.id === 'so-good' ? book.title : book.shortTitle}
              </button>
            ))}
          </div>
        </div>}
        {!isFocusReader && <div className="border-t border-slate-200/70 px-3 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-500 whitespace-nowrap">{Math.round(readingProgress)}% · ~{remainingMinutes} min left</span>
          <span className="h-4 w-px bg-slate-200" />
          <button onClick={() => setReaderTone('paper')} data-active={readerTone==='paper'} className="px-2 h-7 rounded-md text-xs bg-slate-100">Light</button>
          <button onClick={() => setReaderTone('sepia')} data-active={readerTone==='sepia'} className="px-2 h-7 rounded-md text-xs bg-amber-50">Sepia</button>
          <button onClick={() => setReaderTone('night')} data-active={readerTone==='night'} className="px-2 h-7 rounded-md text-xs bg-slate-800 text-white">Dark</button>
          <span className="h-4 w-px bg-slate-200" />
          <button onClick={() => setReaderFont(v => v==='serif'?'sans':'serif')} className="px-2 h-7 rounded-md text-xs bg-slate-100"><Type className="inline w-3.5 h-3.5 mr-1" />{readerFont}</button>
          <button onClick={() => setLineHeight(v => v >= 2.1 ? 1.6 : Number((v+.1).toFixed(1)))} className="px-2 h-7 rounded-md text-xs bg-slate-100"><AlignJustify className="inline w-3.5 h-3.5 mr-1" />Spacing</button>
          <button onClick={() => setReaderWidth(v => v==='narrow'?'medium':v==='medium'?'wide':'narrow')} className="px-2 h-7 rounded-md text-xs bg-slate-100">Width: {readerWidth}</button>
          <button onClick={() => toggleBookmark(currentSections[Math.min(currentSections.length-1, Math.floor(readingProgress/100*currentSections.length))])} className="px-2 h-7 rounded-md text-xs bg-slate-100"><Bookmark className="inline w-3.5 h-3.5 mr-1" />Bookmark</button>
          <button onClick={() => { const note=window.prompt('Add a note for this book', notes[activeBookId] || ''); if(note!==null)setNotes(p=>({...p,[activeBookId]:note})); }} className="px-2 h-7 rounded-md text-xs bg-slate-100"><StickyNote className="inline w-3.5 h-3.5 mr-1" />Note</button>
          <button onClick={() => setIsHighlightsOpen(v => !v)} className="px-2 h-7 inline-flex items-center rounded-md text-xs bg-slate-100"><Highlighter className="w-3.5 h-3.5 mr-1" />Highlights {(highlights[activeBookId]||[]).length}</button>
        </div>}
      </header>

      {pendingSelection && <div className="absolute z-[100] w-[200px] rounded-xl border border-slate-200 bg-white shadow-lg p-2" style={{ left: pendingSelection.x, top: pendingSelection.y }}>
        <div className="text-[11px] text-slate-500 px-1 pb-2 truncate">{pendingSelection.text}</div>
        <div className="flex items-center justify-between">
          {(['yellow','blue','pink','green'] as HighlightColor[]).map(color => <button key={color} onClick={() => createHighlight(color)} aria-label={`Highlight ${color}`} className={`w-7 h-7 rounded-full border border-black/10 ${color==='yellow'?'bg-yellow-300':color==='blue'?'bg-blue-300':color==='pink'?'bg-pink-300':'bg-green-300'}`} />)}
          <button onClick={() => setPendingSelection(null)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
      </div>}

      {isHighlightsOpen && <aside className="fixed right-0 top-0 z-[90] h-screen w-full sm:w-[380px] border-l border-slate-200 bg-white shadow-xl flex flex-col">
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between"><div><div className="font-semibold text-sm">Highlights & Notes</div><div className="text-[11px] text-slate-500">{activeBook.shortTitle} · {(highlights[activeBookId]||[]).length} highlights</div></div><button onClick={() => setIsHighlightsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(highlights[activeBookId]||[]).length === 0 ? <div className="py-16 text-center text-sm text-slate-500">Select text in the reader to create your first highlight.</div> : (highlights[activeBookId]||[]).slice().reverse().map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-3">
            <button onClick={() => { jumpTo(item.sectionId); setIsHighlightsOpen(false); }} className="w-full text-left">
              <div className={`border-l-4 pl-2 text-sm leading-6 ${item.color==='yellow'?'border-yellow-400':item.color==='blue'?'border-blue-400':item.color==='pink'?'border-pink-400':'border-green-400'}`}>{item.text}</div>
              <div className="mt-2 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
            </button>
            <textarea value={item.note} onChange={e => updateHighlightNote(item.id,e.target.value)} placeholder="Add note…" rows={2} className="mt-2 w-full resize-none rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
            <div className="mt-2 flex justify-end"><button onClick={() => deleteHighlight(item.id)} className="text-[11px] text-red-500 hover:text-red-600">Delete</button></div>
          </div>)}
        </div>
      </aside>}

      <div className={`w-full ${isFocusReader ? 'px-0 py-0' : 'px-3 sm:px-5 lg:px-7 py-4 lg:py-5'}`}>
        <main className="min-w-0">
          <article
            className={`rounded-xl border overflow-hidden ${cardClasses}`}
          >
            <div
              className={`px-5 sm:px-8 lg:px-12 py-8 sm:py-10 border-b ${
                readerTone === 'night' ? 'border-[#2b3035]' : 'border-black/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-1 text-[11px] font-semibold">
                  {activeBook.year}
                </span>
                <span className={`text-[11px] font-bold ${mutedText}`}>
                  {activeBook.readingTime}
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.04]">
                {activeBook.title}
              </h2>
              <p className="mt-3 text-base sm:text-lg font-semibold text-blue-600">
                {activeBook.focus}
              </p>
              <p
                className={`mt-4 max-w-3xl text-sm sm:text-base leading-7 font-semibold ${mutedText}`}
              >
                {activeBook.whyItMatters}
              </p>
            </div>

            <div
              className="px-5 sm:px-8 lg:px-12 py-7 sm:py-10"
              onMouseUp={captureSelection}
              style={{ fontSize: `${fontScale}rem`, fontFamily, lineHeight }}
            >
              <section id="overview" className={`${widthClass} mx-auto scroll-mt-28`}>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3
                    className="text-xl sm:text-2xl font-semibold"
                    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                  >
                    Overview
                  </h3>
                </div>
                <div className="space-y-5 leading-[1.9]">
                  {activeBook.overview.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  )})}
                </div>
              </section>

              <div
                className={`max-w-[820px] mx-auto my-9 border-t ${
                  readerTone === 'night' ? 'border-[#343a40]' : 'border-black/10'
                }`}
              />

              <section className="max-w-[920px] mx-auto">
                <div className="flex items-center gap-2 mb-5">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h3
                    className="text-xl sm:text-2xl font-semibold"
                    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                  >
                    Key Themes
                  </h3>
                </div>

                <div className="space-y-5">
                  {activeBook.themes.filter((themeItem) => !searchQuery || [themeItem.title, themeItem.shortIdea, ...themeItem.explanation].join(' ').toLowerCase().includes(searchQuery.toLowerCase())).map((themeItem) => { const themeIndex = activeBook.themes.indexOf(themeItem); return (
                    <details
                      id={`theme-${themeIndex}`}
                      key={themeItem.title}
                      open={themeIndex === 0}
                      className={`group rounded-xl border overflow-hidden ${
                        readerTone === 'night'
                          ? 'border-[#343a40] bg-[#15181a]'
                          : readerTone === 'sepia'
                          ? 'border-[#dfd1b6] bg-[#fff8e8]'
                          : 'border-black/10 bg-white/70'
                      }`}
                    >
                      <summary className="cursor-pointer list-none px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                        <div>
                          <h4
                            className="text-base sm:text-lg font-semibold leading-snug"
                            style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                          >
                            {themeItem.title}
                          </h4>
                          <p className={`mt-1 text-sm leading-6 font-semibold ${mutedText}`}>
                            {themeItem.shortIdea}
                          </p>
                        </div>
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                            readerTone === 'night' ? 'bg-white/5' : 'bg-black/5'
                          }`}
                        >
                          +
                        </span>
                      </summary>

                      <div
                        className={`px-4 sm:px-5 pb-5 pt-1 border-t ${
                          readerTone === 'night' ? 'border-[#343a40]' : 'border-black/10'
                        }`}
                      >
                        <div className="space-y-4 leading-[1.9] pt-4">
                          {themeItem.explanation.map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-6">
                          {themeItem.examples.map((example, index) => (
                            <div
                              key={example.title}
                              className={`rounded-xl border p-4 ${
                                readerTone === 'night'
                                  ? 'border-[#343a40] bg-white/[0.025]'
                                  : 'border-black/10 bg-black/[0.02]'
                              }`}
                            >
                              <div
                                className="text-[11px] uppercase tracking-[0.14em] font-semibold text-blue-600"
                                style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                              >
                                Real-world example {index + 1}
                              </div>
                              <h5
                                className="mt-1 text-sm font-semibold"
                                style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                              >
                                {example.title}
                              </h5>
                              <p className={`mt-2 text-sm leading-7 ${mutedText}`}>
                                {example.body}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div
                          className={`mt-6 rounded-xl border p-4 ${
                            readerTone === 'night'
                              ? 'border-emerald-900/50 bg-emerald-950/20'
                              : 'border-emerald-200 bg-emerald-50/70'
                          }`}
                        >
                          <div
                            className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                            style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                          >
                            <Target className="w-4 h-4" />
                            Key Action Plan
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {themeItem.actionPlan.map((step, index) => (
                              <div key={step} className="flex items-start gap-2.5">
                                <span
                                  className="w-5 h-5 mt-0.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-semibold shrink-0"
                                  style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                                >
                                  {index + 1}
                                </span>
                                <span className="text-sm leading-7">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <div
                className={`max-w-[820px] mx-auto my-10 border-t ${
                  readerTone === 'night' ? 'border-[#343a40]' : 'border-black/10'
                }`}
              />

              <section id="summary" className={`${widthClass} mx-auto scroll-mt-28`}>
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked className="w-5 h-5 text-violet-600" />
                  <h3
                    className="text-xl sm:text-2xl font-semibold"
                    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                  >
                    Summary
                  </h3>
                </div>
                <div className="space-y-5 leading-[1.9]">
                  {activeBook.summary.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>

                <div
                  className={`mt-7 rounded-xl border p-5 ${
                    readerTone === 'night'
                      ? 'border-blue-900/50 bg-blue-950/20'
                      : 'border-blue-200 bg-blue-50/80'
                  }`}
                >
                  <div
                    className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300"
                    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Concise Action Plan
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {activeBook.conciseActionPlan.map((step, index) => (
                      <div
                        key={step}
                        className={`rounded-xl border p-3 flex items-start gap-2.5 ${
                          readerTone === 'night'
                            ? 'border-blue-900/40 bg-white/[0.025]'
                            : 'border-blue-100 bg-white/70'
                        }`}
                      >
                        <span
                          className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-semibold shrink-0"
                          style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm leading-6">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="max-w-[820px] mx-auto mt-10 text-center">
                <div className={`text-xs font-semibold leading-6 ${mutedText}`}>
                  This is an original practical study guide designed for System Builder.
                  It summarizes ideas in new language and does not reproduce the books.
                </div>
              </section>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
};
