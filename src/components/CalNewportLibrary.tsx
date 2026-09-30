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
import { CAL_NEWPORT_FULL_STUDY } from '../data/calNewportFullStudy';
import { RYAN_HOLIDAY_BOOKS, RYAN_HOLIDAY_LIBRARY_UPDATED } from '../data/ryanHolidayLibrary';
import { RYAN_HOLIDAY_FULL_STUDY } from '../data/ryanHolidayFullStudy';
import { buildResearchEdition } from '../data/bookResearchEdition';

type ReaderTone = 'paper' | 'sepia' | 'night';
type ReaderFont = 'serif' | 'sans';
type HighlightColor = 'yellow' | 'blue' | 'pink' | 'green';
interface ReaderHighlight { id:string; text:string; color:HighlightColor; note:string; sectionId:string; createdAt:string; }

interface CalNewportLibraryProps {
  theme: DashboardTheme;
  onBack: () => void;
  focusMode?: boolean;
  onFocusChange?: (focused: boolean) => void;
}

const ACTIVE_BOOK_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_ACTIVE_BOOK';
const FONT_SCALE_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_FONT_SCALE';
const READER_SETTINGS_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_READER_SETTINGS';
const READER_STATE_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_READER_STATE';
const AUTHOR_KEY = 'SYSTEM_BUILDER_BOOKS_AUTHOR';

export const CalNewportLibrary: React.FC<CalNewportLibraryProps> = ({
  theme: _theme,
  onBack,
  focusMode,
  onFocusChange,
}) => {
  const [author, setAuthor] = useState<'cal' | 'ryan'>(() => typeof window !== 'undefined' && window.localStorage.getItem(AUTHOR_KEY) === 'ryan' ? 'ryan' : 'cal');
  const books = author === 'ryan' ? RYAN_HOLIDAY_BOOKS : CAL_NEWPORT_BOOKS;
  const fullStudy = author === 'ryan' ? RYAN_HOLIDAY_FULL_STUDY : CAL_NEWPORT_FULL_STUDY;
  const [activeBookId, setActiveBookId] = useState<CalNewportBook['id']>(() => {
    if (typeof window === 'undefined') return 'so-good';
    const stored = window.localStorage.getItem(ACTIVE_BOOK_KEY);
    return [...CAL_NEWPORT_BOOKS, ...RYAN_HOLIDAY_BOOKS].some((book) => book.id === stored)
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
  const [readingProgress, setReadingProgress] = useState(0);
  const [studyMode, setStudyMode] = useState<'concise'|'full'|'research'>('concise');
  const isFullStudy = studyMode === 'full';
  const isResearch = studyMode === 'research';
  const [internalFocusReader, setInternalFocusReader] = useState(false);
  const isFocusReader = focusMode ?? internalFocusReader;
  const setIsFocusReader = (updater: boolean | ((value: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(isFocusReader) : updater;
    if (focusMode !== undefined) onFocusChange?.(next);
    else setInternalFocusReader(next);
  };
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, ReaderHighlight[]>>({});
  const [pendingSelection, setPendingSelection] = useState<{text:string;sectionId:string;x:number;y:number}|null>(null);
  const [isHighlightsOpen, setIsHighlightsOpen] = useState(false);
  const [noteEditor, setNoteEditor] = useState<{ sectionId: string; value: string } | null>(null);
  const [readerStateLoaded, setReaderStateLoaded] = useState(false);
  const [activeReaderSection, setActiveReaderSection] = useState('overview');
  const [completedBooks, setCompletedBooks] = useState<string[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<string[]>(() => CAL_NEWPORT_BOOKS.filter((book) => book.favorite).map((book) => book.id));

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) || books[0],
    [activeBookId, author]
  );

  const researchEdition = useMemo(
    () => buildResearchEdition(activeBook, fullStudy[activeBook.id]),
    [activeBook, fullStudy]
  );

  useEffect(() => {
    if (!books.some(book => book.id === activeBookId)) setActiveBookId(books[0].id);
    window.localStorage.setItem(AUTHOR_KEY, author);
  }, [author]);

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
      const state = JSON.parse(window.localStorage.getItem(READER_STATE_KEY) || '{}');
      setBookmarks(state.bookmarks || {}); setNotes(state.notes || {});
      const raw = state.highlights || {}; setHighlights(Object.fromEntries(Object.entries(raw).map(([k,v]:[string,any]) => [k,(Array.isArray(v)?v:[]).map((x:any,i:number)=>typeof x==='string'?{id:`legacy-${k}-${i}`,text:x,color:'yellow',note:'',sectionId:'overview',createdAt:new Date().toISOString()}:x)])));

      setCompletedBooks(state.completedBooks || []); if (state.favoriteBooks) setFavoriteBooks(state.favoriteBooks);
      const y = Number(state.positions?.[activeBookId] || 0); if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch { /* keep defaults */ }
    finally { setReaderStateLoaded(true); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ readerTone, readerFont }));
  }, [readerTone, readerFont]);

  useEffect(() => {
    if (!readerStateLoaded) return;
    const save = () => {
      let previous: any = {}; try { previous = JSON.parse(window.localStorage.getItem(READER_STATE_KEY) || '{}'); } catch {}
      window.localStorage.setItem(READER_STATE_KEY, JSON.stringify({ ...previous, bookmarks, notes, highlights, completedBooks, favoriteBooks, positions: { ...(previous.positions || {}), [activeBookId]: window.scrollY } }));
    };
    const onScroll = () => save(); window.addEventListener('scroll', onScroll, { passive: true }); save();
    return () => { window.removeEventListener('scroll', onScroll); save(); };
  }, [activeBookId, bookmarks, notes, highlights, completedBooks, favoriteBooks, readerStateLoaded]);

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
  const widthClass = 'max-w-[1080px]';
  const fontFamily = readerFont === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Inter, ui-sans-serif, system-ui, sans-serif';
  const currentSections = useMemo(() => {
    if (isResearch) {
      return ['research-intro', ...researchEdition.sections.map((_, index) => `research-${index}`)];
    }
    if (isFullStudy) {
      return ['full-intro', ...fullStudy[activeBookId].sections.map((_, index) => `full-${index}`), 'full-final'];
    }
    return ['overview', ...activeBook.themes.map((_, index) => `theme-${index}`), 'summary'];
  }, [activeBook.themes, activeBookId, fullStudy, isFullStudy, isResearch, researchEdition.sections]);

  const getSectionMode = (id: string): 'concise' | 'full' | 'research' =>
    id.startsWith('research-') ? 'research' : id.startsWith('full-') ? 'full' : 'concise';

  const jumpTo = (id: string) => {
    const requiredMode = getSectionMode(id);
    if (studyMode !== requiredMode) setStudyMode(requiredMode);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const getCurrentSection = () => {
    const availableSections = currentSections
      .map((id) => ({ id, element: document.getElementById(id) }))
      .filter((item): item is { id: string; element: HTMLElement } => Boolean(item.element));

    if (availableSections.length === 0) return currentSections[0] || 'overview';

    let current = availableSections[0].id;
    for (const item of availableSections) {
      if (item.element.getBoundingClientRect().top <= 190) current = item.id;
      else break;
    }
    return current;
  };

  const getSectionLabel = (id: string) => {
    if (id === 'overview') return 'Overview';
    if (id === 'summary') return 'Summary';
    if (id === 'research-intro') return 'Research Introduction';
    if (id === 'full-intro') return 'Full Study Introduction';
    if (id === 'full-final') return 'Final Review & 30-Day Transfer';

    if (id.startsWith('theme-')) {
      const index = Number(id.replace('theme-', ''));
      return activeBook.themes[index]?.title || `Theme ${index + 1}`;
    }
    if (id.startsWith('research-')) {
      const index = Number(id.replace('research-', ''));
      return researchEdition.sections[index]?.title || `Research Section ${index + 1}`;
    }
    if (id.startsWith('full-')) {
      const index = Number(id.replace('full-', ''));
      return fullStudy[activeBookId].sections[index]?.title || `Full Study Section ${index + 1}`;
    }
    return id;
  };

  const renderHighlightedText = (text: string, sectionId: string): React.ReactNode => {
    const matches = (highlights[activeBookId] || [])
      .map((highlight) => ({
        highlight,
        start: highlight.text ? text.indexOf(highlight.text) : -1,
      }))
      .filter(({ highlight, start }) => highlight.sectionId === sectionId && start >= 0)
      .sort((a, b) => a.start - b.start || b.highlight.text.length - a.highlight.text.length);

    if (matches.length === 0) return text;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (const { highlight, start } of matches) {
      if (start < cursor) continue;
      if (start > cursor) nodes.push(text.slice(cursor, start));

      const end = start + highlight.text.length;
      const colorClass =
        highlight.color === 'yellow'
          ? 'bg-yellow-200/90 dark:bg-yellow-500/35'
          : highlight.color === 'blue'
          ? 'bg-blue-200/90 dark:bg-blue-500/35'
          : highlight.color === 'pink'
          ? 'bg-pink-200/90 dark:bg-pink-500/35'
          : 'bg-green-200/90 dark:bg-green-500/35';

      nodes.push(
        <mark
          key={`${highlight.id}-${start}`}
          className={`rounded px-0.5 text-inherit ${colorClass}`}
          title={highlight.note || 'Saved highlight'}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
    }

    if (cursor < text.length) nodes.push(text.slice(cursor));
    return <>{nodes}</>;
  };

  const toggleBookmark = (id: string) =>
    setBookmarks((prev) => ({
      ...prev,
      [activeBookId]: (prev[activeBookId] || []).includes(id)
        ? (prev[activeBookId] || []).filter((sectionId) => sectionId !== id)
        : [...(prev[activeBookId] || []), id],
    }));

  const toggleFavorite = () => setFavoriteBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);
  const toggleComplete = () => setCompletedBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);

  const captureSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    const readerContent = node?.closest('[data-reader-content="true"]');
    if (!readerContent) return;

    const section = node?.closest('[data-reader-section="true"]') as HTMLElement | null;
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const paletteWidth = 210;
    const paletteHeight = 68;
    const x = Math.max(8, Math.min(window.innerWidth - paletteWidth - 8, rect.left + rect.width / 2 - paletteWidth / 2));
    const y =
      rect.bottom + paletteHeight + 12 <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - paletteHeight - 8);

    setPendingSelection({
      text,
      sectionId: section?.id || getCurrentSection(),
      x,
      y,
    });
  };

  const createHighlight = (color: HighlightColor) => {
    if (!pendingSelection) return;
    const highlight: ReaderHighlight = {
      id: `hl-${Date.now()}`,
      text: pendingSelection.text,
      color,
      note: '',
      sectionId: pendingSelection.sectionId,
      createdAt: new Date().toISOString(),
    };
    setHighlights((prev) => ({
      ...prev,
      [activeBookId]: [...(prev[activeBookId] || []), highlight],
    }));
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const updateHighlightNote = (id: string, note: string) =>
    setHighlights((prev) => ({
      ...prev,
      [activeBookId]: (prev[activeBookId] || []).map((highlight) =>
        highlight.id === id ? { ...highlight, note } : highlight
      ),
    }));

  const deleteHighlight = (id: string) =>
    setHighlights((prev) => ({
      ...prev,
      [activeBookId]: (prev[activeBookId] || []).filter((highlight) => highlight.id !== id),
    }));

  const openSectionNote = (sectionId = getCurrentSection()) => {
    const key = `${activeBookId}::${sectionId}`;
    setNoteEditor({ sectionId, value: notes[key] || '' });
  };

  const saveSectionNote = () => {
    if (!noteEditor) return;
    const key = `${activeBookId}::${noteEditor.sectionId}`;
    const value = noteEditor.value.trim();
    setNotes((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setNoteEditor(null);
  };

  const updateSectionNote = (sectionId: string, value: string) => {
    const key = `${activeBookId}::${sectionId}`;
    setNotes((prev) => ({ ...prev, [key]: value }));
  };

  const deleteSectionNote = (sectionId: string) => {
    const key = `${activeBookId}::${sectionId}`;
    setNotes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (noteEditor?.sectionId === sectionId) setNoteEditor(null);
  };

  const activeBookmarks = bookmarks[activeBookId] || [];
  const activeSectionNotes = (Object.entries(notes) as Array<[string, string]>)
    .filter(([key, value]) => key.startsWith(`${activeBookId}::`) && Boolean(value.trim()))
    .map(([key, value]) => ({ sectionId: key.slice(activeBookId.length + 2), value }));

  useEffect(() => {
    const syncActiveSection = () => setActiveReaderSection(getCurrentSection());
    syncActiveSection();
    window.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('resize', syncActiveSection);
    return () => {
      window.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('resize', syncActiveSection);
    };
  }, [activeBookId, studyMode, currentSections]);
  const remainingMinutes = Math.max(0, Math.ceil((100 - readingProgress) / 100 * Number(activeBook.readingTime.match(/\d+/)?.[0] || 20)));

  const selectBook = (book: CalNewportBook) => { setActiveBookId(book.id); setStudyMode('concise'); };
  const openFullStudy = (book: CalNewportBook) => { setActiveBookId(book.id); setStudyMode('full'); requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'})); };
  const openResearch = (book: CalNewportBook) => { setActiveBookId(book.id); setStudyMode('research'); requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'})); };
  const handleBookClick = (book: CalNewportBook, detail:number) => { if(detail >= 3) openResearch(book); else if(detail === 2) openFullStudy(book); else selectBook(book); };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${toneClasses}`}>
      <div className="fixed top-0 left-0 right-0 z-[70] h-1 bg-black/10">
        <div
          className="h-full bg-blue-600 transition-[width] duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <header className="sticky top-0 z-[60] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="w-full px-2.5 sm:px-5 lg:px-7 h-14 flex items-center justify-between gap-2 sm:gap-3">
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
                <h1 onDoubleClick={() => { const next = author === 'cal' ? 'ryan' : 'cal'; setAuthor(next); setActiveBookId(next === 'ryan' ? RYAN_HOLIDAY_BOOKS[0].id : CAL_NEWPORT_BOOKS[0].id); setStudyMode('concise'); }} title="Double-click to switch author" className="text-base font-semibold tracking-tight truncate cursor-pointer select-none">
                  By {author === 'ryan' ? 'Ryan Holiday' : 'Cal Newport'}
                </h1>
              </div>
              <p className={`text-[11px] sm:text-xs font-semibold ${mutedText}`}>
                Practical reading library • Updated {author === 'ryan' ? RYAN_HOLIDAY_LIBRARY_UPDATED : CAL_NEWPORT_LIBRARY_UPDATED} · Double-click author to switch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setIsTocOpen(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Table of contents"><List className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsSearchOpen(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Search this guide"><Search className="w-4 h-4" /></button>
            <button type="button" onClick={toggleFavorite} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Favorite"><Star className={`w-4 h-4 ${favoriteBooks.includes(activeBookId) ? 'fill-current text-amber-500' : ''}`} /></button>
            <button type="button" onClick={toggleComplete} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Mark complete"><Check className={`w-4 h-4 ${completedBooks.includes(activeBookId) ? 'text-emerald-600' : ''}`} /></button>
            <button type="button" onClick={() => setIsFocusReader(v => !v)} className="h-8 w-8 rounded-lg hover:bg-black/5 flex items-center justify-center" title="Distraction-free reading">{isFocusReader ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          </div>

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

        {!isFocusReader && (
          <div className="w-full px-3 sm:px-5 lg:px-7 pb-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              {books.map((book, index) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={(event) => handleBookClick(book, event.detail)}
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
          </div>
        )}
        {!isFocusReader && <div className="border-t border-slate-200/70 px-3 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-500 whitespace-nowrap">{Math.round(readingProgress)}% · ~{remainingMinutes} min left</span>
          <span className="h-4 w-px bg-slate-200" />
          <button onClick={() => setReaderTone('paper')} data-active={readerTone==='paper'} className="px-2 h-7 rounded-md text-xs bg-slate-100">Light</button>
          <button onClick={() => setReaderTone('sepia')} data-active={readerTone==='sepia'} className="px-2 h-7 rounded-md text-xs bg-amber-50">Sepia</button>
          <button onClick={() => setReaderTone('night')} data-active={readerTone==='night'} className="px-2 h-7 rounded-md text-xs bg-slate-800 text-white">Dark</button>
          <span className="h-4 w-px bg-slate-200" />
          <button onClick={() => setReaderFont(v => v==='serif'?'sans':'serif')} className="px-2 h-7 rounded-md text-xs bg-slate-100"><Type className="inline w-3.5 h-3.5 mr-1" />{readerFont}</button>
          <button
            type="button"
            onClick={() => toggleBookmark(activeReaderSection)}
            aria-pressed={activeBookmarks.includes(activeReaderSection)}
            className={`px-2 h-7 rounded-md text-xs inline-flex items-center whitespace-nowrap ${
              activeBookmarks.includes(activeReaderSection)
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 mr-1" fill={activeBookmarks.includes(activeReaderSection) ? 'currentColor' : 'none'} />
            {activeBookmarks.includes(activeReaderSection) ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button
            type="button"
            onClick={() => openSectionNote(activeReaderSection)}
            className={`px-2 h-7 rounded-md text-xs inline-flex items-center whitespace-nowrap ${
              notes[`${activeBookId}::${activeReaderSection}`]
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 mr-1" />
            {notes[`${activeBookId}::${activeReaderSection}`] ? 'Edit Note' : 'Note'}
          </button>
          <button
            type="button"
            onClick={() => setIsHighlightsOpen(true)}
            className="px-2 h-7 inline-flex items-center rounded-md text-xs bg-slate-100 dark:bg-slate-800 whitespace-nowrap"
          >
            <Highlighter className="w-3.5 h-3.5 mr-1" />
            Annotations {activeBookmarks.length + activeSectionNotes.length + (highlights[activeBookId] || []).length}
          </button>
        </div>}
      </header>

      {pendingSelection && (
        <div
          className="fixed z-[230] w-[210px] rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl"
          style={{ left: pendingSelection.x, top: pendingSelection.y }}
          onMouseDown={(event) => event.preventDefault()}
          role="toolbar"
          aria-label="Highlight selected text"
        >
          <div className="truncate px-1 pb-2 text-[11px] text-slate-500">
            {pendingSelection.text}
          </div>
          <div className="flex justify-between">
            {(['yellow', 'blue', 'pink', 'green'] as HighlightColor[]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => createHighlight(color)}
                className={`h-8 w-8 rounded-full border border-black/10 ${
                  color === 'yellow'
                    ? 'bg-yellow-300'
                    : color === 'blue'
                    ? 'bg-blue-300'
                    : color === 'pink'
                    ? 'bg-pink-300'
                    : 'bg-green-300'
                }`}
                title={`Highlight ${color}`}
                aria-label={`Highlight selected text ${color}`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setPendingSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Cancel highlight"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isHighlightsOpen && (
        <aside className="fixed inset-y-0 right-0 z-[220] flex w-full flex-col border-l border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] text-slate-900 shadow-2xl sm:w-[410px]">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Reader Annotations</div>
              <div className="truncate text-[11px] text-slate-500">
                {activeBookmarks.length} bookmarks · {activeSectionNotes.length} notes · {(highlights[activeBookId] || []).length} highlights
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsHighlightsOpen(false)}
              className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"
              aria-label="Close annotations"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-3">
            {activeBookmarks.length === 0 &&
            activeSectionNotes.length === 0 &&
            (highlights[activeBookId] || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-14 text-center text-sm text-slate-500">
                Add a bookmark, write a section note, or select text to create a highlight.
              </div>
            ) : null}

            {activeBookmarks.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Bookmark className="h-3.5 w-3.5" />
                  Bookmarks
                </div>
                <div className="space-y-2">
                  {activeBookmarks.map((sectionId) => (
                    <div key={sectionId} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm font-semibold text-slate-800"
                        onClick={() => {
                          jumpTo(sectionId);
                          setIsHighlightsOpen(false);
                        }}
                      >
                        {getSectionLabel(sectionId)}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBookmark(sectionId)}
                        className="h-8 shrink-0 rounded-lg px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeSectionNotes.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <StickyNote className="h-3.5 w-3.5" />
                  Section Notes
                </div>
                <div className="space-y-3">
                  {activeSectionNotes.map(({ sectionId, value }) => (
                    <div key={sectionId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 truncate text-left text-xs font-bold text-blue-700"
                          onClick={() => {
                            jumpTo(sectionId);
                            setIsHighlightsOpen(false);
                          }}
                        >
                          {getSectionLabel(sectionId)}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSectionNote(sectionId)}
                          className="shrink-0 text-[11px] font-semibold text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                      <textarea
                        value={value}
                        onChange={(event) => updateSectionNote(sectionId, event.target.value)}
                        rows={3}
                        className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                        aria-label={`Note for ${getSectionLabel(sectionId)}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(highlights[activeBookId] || []).length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Highlighter className="h-3.5 w-3.5" />
                  Highlights
                </div>
                <div className="space-y-3">
                  {(highlights[activeBookId] || [])
                    .slice()
                    .reverse()
                    .map((highlight) => (
                      <div key={highlight.id} className="rounded-xl border border-slate-200 p-3">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            jumpTo(highlight.sectionId);
                            setIsHighlightsOpen(false);
                          }}
                        >
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {getSectionLabel(highlight.sectionId)}
                          </div>
                          <p
                            className={`border-l-4 pl-2 text-sm leading-6 ${
                              highlight.color === 'yellow'
                                ? 'border-yellow-400'
                                : highlight.color === 'blue'
                                ? 'border-blue-400'
                                : highlight.color === 'pink'
                                ? 'border-pink-400'
                                : 'border-green-400'
                            }`}
                          >
                            {highlight.text}
                          </p>
                        </button>
                        <textarea
                          value={highlight.note}
                          onChange={(event) => updateHighlightNote(highlight.id, event.target.value)}
                          placeholder="Add note to highlight…"
                          rows={2}
                          className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => deleteHighlight(highlight.id)}
                          className="mt-2 text-[11px] font-semibold text-rose-600"
                        >
                          Delete highlight
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>
        </aside>
      )}

      {noteEditor && (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/50 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Section note"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNoteEditor(null);
          }}
        >
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Section Note</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {getSectionLabel(noteEditor.sectionId)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteEditor(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close note editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              autoFocus
              value={noteEditor.value}
              onChange={(event) =>
                setNoteEditor((current) =>
                  current ? { ...current, value: event.target.value } : current
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Escape') setNoteEditor(null);
              }}
              placeholder="Write your note for this section…"
              rows={6}
              className="mt-3 max-h-[42dvh] w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                {notes[`${activeBookId}::${noteEditor.sectionId}`] && (
                  <button
                    type="button"
                    onClick={() => deleteSectionNote(noteEditor.sectionId)}
                    className="h-9 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNoteEditor(null)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSectionNote}
                  className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

            <div className={`w-full ${isFocusReader ? 'px-0 py-0' : 'px-3 sm:px-5 lg:px-7 py-4 lg:py-5'}`}>
        <main className="min-w-0">
          <article
            className={`rounded-xl border overflow-hidden ${cardClasses}`}
          >
            <div
              className={`px-4 sm:px-8 lg:px-12 py-6 sm:py-10 border-b ${
                readerTone === 'night' ? 'border-[#2b3035]' : 'border-black/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-1 text-[11px] font-semibold">
                  {activeBook.year}
                </span>
                <span className={`text-[11px] font-bold ${mutedText}`}>
                  {isResearch ? researchEdition.readingTime : isFullStudy ? fullStudy[activeBookId].readingMinutes : activeBook.readingTime}
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

            {isResearch && <div className="px-4 sm:px-8 lg:px-12 py-6 sm:py-10" data-reader-content="true" onPointerUp={captureSelection} onMouseUp={captureSelection} onTouchEnd={() => window.setTimeout(captureSelection, 120)} style={{fontSize:`${fontScale}rem`,fontFamily,lineHeight:1.9}}>
              <section className={`${widthClass} mx-auto`}>
                <div id="research-intro" data-reader-section="true" className="mb-8"><span className="inline-flex rounded-full bg-violet-600 text-white px-3 py-1 text-xs font-semibold">Research Version · {researchEdition.readingTime}</span><h3 className="mt-4 text-2xl font-semibold">Deep Research Companion</h3><p className={`mt-4 text-sm leading-7 ${mutedText}`}>{renderHighlightedText(researchEdition.access, 'research-intro')}</p></div>
                <div className="space-y-10">{researchEdition.sections.map((section,i)=><section key={section.title} id={`research-${i}`} data-reader-section="true" className="scroll-mt-32 border-t border-black/10 pt-7"><h3 className="text-xl sm:text-2xl font-semibold">{section.title}</h3><div className="mt-4 space-y-4">{section.paragraphs.map((x,j)=><p key={j}>{renderHighlightedText(x, `research-${i}`)}</p>)}</div>{section.items && <ul className="mt-5 space-y-3">{section.items.map(x=><li key={x} className="rounded-lg bg-black/[0.03] px-3 py-2">• {renderHighlightedText(x, `research-${i}`)}</li>)}</ul>}</section>)}</div>
              </section>
            </div>}

            {isFullStudy && <div className="px-4 sm:px-8 lg:px-12 py-6 sm:py-10" data-reader-content="true" onPointerUp={captureSelection} onMouseUp={captureSelection} onTouchEnd={() => window.setTimeout(captureSelection, 120)} style={{fontSize:`${fontScale}rem`,fontFamily,lineHeight:1.9}}>
              <section className={`${widthClass} mx-auto`}><div id="full-intro" data-reader-section="true" className="mb-8"><span className="inline-flex rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-semibold">Full Study Version · {fullStudy[activeBookId].readingMinutes}</span><h3 className="mt-4 text-2xl font-semibold">Extended Reading Companion</h3><div className="mt-4 space-y-4">{fullStudy[activeBookId].introduction.map((x,i)=><p key={i}>{renderHighlightedText(x, 'full-intro')}</p>)}</div></div>
              <div className="space-y-8">{fullStudy[activeBookId].sections.map((section,i)=><section key={section.title} id={`full-${i}`} data-reader-section="true" className="scroll-mt-32 border-t border-black/10 pt-7"><h3 className="text-xl font-semibold">{section.title}</h3><div className="mt-4 space-y-4">{section.reading.map((x,j)=><p key={j}>{renderHighlightedText(x, `full-${i}`)}</p>)}</div><h4 className="mt-6 text-sm font-semibold">Applications</h4><ul className="mt-2 space-y-2 text-sm">{section.applications.map(x=><li key={x}>• {renderHighlightedText(x, `full-${i}`)}</li>)}</ul><h4 className="mt-6 text-sm font-semibold">Practice & Action</h4><ol className="mt-2 space-y-2 text-sm">{section.exercises.map((x,j)=><li key={x}>{j+1}. {renderHighlightedText(x, `full-${i}`)}</li>)}</ol><h4 className="mt-6 text-sm font-semibold">Review Questions</h4><ol className="mt-2 space-y-2 text-sm">{section.review.map((x,j)=><li key={x} className="rounded-lg bg-black/[0.03] px-3 py-2">{j+1}. {renderHighlightedText(x, `full-${i}`)}</li>)}</ol></section>)}</div>
              <section id="full-final" data-reader-section="true" className="mt-10 scroll-mt-32 border-t border-black/10 pt-7"><h3 className="text-xl font-semibold">Final Review & 30-Day Transfer</h3><ol className="mt-4 space-y-3">{fullStudy[activeBookId].finalReview.map((x,i)=><li key={x}>{i+1}. {renderHighlightedText(x, 'full-final')}</li>)}</ol></section></section>
            </div>}

            {!isFullStudy && !isResearch &&             <div
              className="px-5 sm:px-8 lg:px-12 py-7 sm:py-10"
              data-reader-content="true"
              onPointerUp={captureSelection}
              onMouseUp={captureSelection}
              onTouchEnd={() => window.setTimeout(captureSelection, 120)}
              style={{ fontSize: `${fontScale}rem`, fontFamily, lineHeight: 1.9 }}
            >
              <section id="overview" data-reader-section="true" className={`${widthClass} mx-auto scroll-mt-28`}>
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
                    <p key={index}>{renderHighlightedText(paragraph, 'overview')}</p>
                  ))}
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
                      data-reader-section="true"
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
                            <p key={index}>{renderHighlightedText(paragraph, `theme-${themeIndex}`)}</p>
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
                                {renderHighlightedText(example.body, `theme-${themeIndex}`)}
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
                                <span className="text-sm leading-7">{renderHighlightedText(step, `theme-${themeIndex}`)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
              </section>

              <div
                className={`max-w-[820px] mx-auto my-10 border-t ${
                  readerTone === 'night' ? 'border-[#343a40]' : 'border-black/10'
                }`}
              />

              <section id="summary" data-reader-section="true" className={`${widthClass} mx-auto scroll-mt-28`}>
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
                    <p key={index}>{renderHighlightedText(paragraph, 'summary')}</p>
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
                        <span className="text-sm leading-6">{renderHighlightedText(step, 'summary')}</span>
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
            </div>}
          </article>
        </main>
      </div>
    </div>
  );
};
