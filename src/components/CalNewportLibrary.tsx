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
import { CAL_NEWPORT_FULL_STUDY } from '../data/calNewportFullStudy';

type ReaderTone = 'paper' | 'sepia' | 'night';
type ReaderFont = 'serif' | 'sans';
type ReaderWidth = 'narrow' | 'medium' | 'wide';
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

export const CalNewportLibrary: React.FC<CalNewportLibraryProps> = ({
  theme: _theme,
  onBack,
  focusMode,
  onFocusChange,
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
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('wide');
  const [lineHeight, setLineHeight] = useState(1.9);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isFullStudy, setIsFullStudy] = useState(false);
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
      const raw = state.highlights || {}; setHighlights(Object.fromEntries(Object.entries(raw).map(([k,v]:[string,any]) => [k,(Array.isArray(v)?v:[]).map((x:any,i:number)=>typeof x==='string'?{id:`legacy-${k}-${i}`,text:x,color:'yellow',note:'',sectionId:'overview',createdAt:new Date().toISOString()}:x)])));

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
  const getCurrentSection = () => {
    const ids = ['overview', ...activeBook.themes.map((_,i)=>`theme-${i}`), 'summary'];
    let current = 'overview'; for (const id of ids) { const el=document.getElementById(id); if(el && el.getBoundingClientRect().top <= 180) current=id; } return current;
  };
  const toggleBookmark = (id: string) => setBookmarks((prev) => ({ ...prev, [activeBookId]: (prev[activeBookId] || []).includes(id) ? (prev[activeBookId] || []).filter((x) => x !== id) : [...(prev[activeBookId] || []), id] }));
  const toggleFavorite = () => setFavoriteBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);
  const toggleComplete = () => setCompletedBooks((prev) => prev.includes(activeBookId) ? prev.filter((id) => id !== activeBookId) : [...prev, activeBookId]);
  const captureSelection = () => { const s=window.getSelection(); const text=s?.toString().trim(); if(!s||!text||!s.rangeCount)return; const r=s.getRangeAt(0), rect=r.getBoundingClientRect(); const n=r.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?r.commonAncestorContainer as Element:r.commonAncestorContainer.parentElement; const section=n?.closest('[id^="theme-"],#overview,#summary') as HTMLElement|null; setPendingSelection({text,sectionId:section?.id||getCurrentSection(),x:Math.max(12,Math.min(window.innerWidth-230,rect.left+rect.width/2-105)),y:rect.bottom+window.scrollY+8}); };
  const createHighlight=(color:HighlightColor)=>{if(!pendingSelection)return;const h:ReaderHighlight={id:`hl-${Date.now()}`,text:pendingSelection.text,color,note:'',sectionId:pendingSelection.sectionId,createdAt:new Date().toISOString()};setHighlights(p=>({...p,[activeBookId]:[...(p[activeBookId]||[]),h]}));setPendingSelection(null);window.getSelection()?.removeAllRanges();};
  const updateHighlightNote=(id:string,note:string)=>setHighlights(p=>({...p,[activeBookId]:(p[activeBookId]||[]).map(h=>h.id===id?{...h,note}:h)}));
  const deleteHighlight=(id:string)=>setHighlights(p=>({...p,[activeBookId]:(p[activeBookId]||[]).filter(h=>h.id!==id)}));
  const addSectionNote=()=>{const section=getCurrentSection();const key=`${activeBookId}::${section}`;const note=window.prompt('Note for this section',notes[key]||'');if(note!==null)setNotes(p=>({...p,[key]:note}));};
  const remainingMinutes = Math.max(0, Math.ceil((100 - readingProgress) / 100 * Number(activeBook.readingTime.match(/\d+/)?.[0] || 20)));

  const selectBook = (book: CalNewportBook) => { setActiveBookId(book.id); setIsFullStudy(false); };
  const openFullStudy = (book: CalNewportBook) => { setActiveBookId(book.id); setIsFullStudy(true); requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'})); };

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
              {CAL_NEWPORT_BOOKS.map((book, index) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => selectBook(book)}
                  onDoubleClick={() => openFullStudy(book)}
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
          <button onClick={() => setLineHeight(v => v >= 2.1 ? 1.6 : Number((v+.1).toFixed(1)))} className="px-2 h-7 rounded-md text-xs bg-slate-100"><AlignJustify className="inline w-3.5 h-3.5 mr-1" />Spacing</button>
          <button onClick={() => setReaderWidth(v => v==='narrow'?'medium':v==='medium'?'wide':'narrow')} className="px-2 h-7 rounded-md text-xs bg-slate-100">Width: {readerWidth}</button>
          <button onClick={() => toggleBookmark(getCurrentSection())} className="px-2 h-7 rounded-md text-xs bg-slate-100"><Bookmark className="inline w-3.5 h-3.5 mr-1" />Bookmark</button>
          <button onClick={addSectionNote} className="px-2 h-7 rounded-md text-xs bg-slate-100"><StickyNote className="inline w-3.5 h-3.5 mr-1" />Note</button>
          <button onClick={()=>setIsHighlightsOpen(true)} className="px-2 h-7 inline-flex items-center rounded-md text-xs bg-slate-100"><Highlighter className="w-3.5 h-3.5 mr-1" />Highlights {(highlights[activeBookId]||[]).length}</button>
        </div>}
      </header>

      {pendingSelection && <div className="absolute z-[100] w-[210px] rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl p-2" style={{left:pendingSelection.x,top:pendingSelection.y}} onMouseDown={e=>e.preventDefault()}><div className="text-[11px] text-slate-500 truncate px-1 pb-2">{pendingSelection.text}</div><div className="flex justify-between">{(['yellow','blue','pink','green'] as HighlightColor[]).map(color=><button key={color} onClick={()=>createHighlight(color)} className={`w-8 h-8 rounded-full border border-black/10 ${color==='yellow'?'bg-yellow-300':color==='blue'?'bg-blue-300':color==='pink'?'bg-pink-300':'bg-green-300'}`} title={`Highlight ${color}`}/>)}<button onClick={()=>setPendingSelection(null)} className="w-8 h-8 flex items-center justify-center"><X className="w-4 h-4"/></button></div></div>}
      {isHighlightsOpen && <aside className="fixed inset-y-0 right-0 z-[100] w-full sm:w-[390px] bg-white text-slate-900 border-l border-slate-200 shadow-xl flex flex-col"><div className="h-14 px-4 border-b flex items-center justify-between"><div><div className="font-semibold text-sm">Highlights & Notes</div><div className="text-[11px] text-slate-500">{(highlights[activeBookId]||[]).length} highlights</div></div><button onClick={()=>setIsHighlightsOpen(false)} className="w-8 h-8 flex items-center justify-center"><X className="w-4 h-4"/></button></div><div className="flex-1 overflow-y-auto p-3 space-y-2">{(highlights[activeBookId]||[]).length===0?<div className="py-16 text-center text-sm text-slate-500">Select text to create a highlight.</div>:(highlights[activeBookId]||[]).slice().reverse().map(h=><div key={h.id} className="border rounded-lg p-3"><button className="w-full text-left" onClick={()=>{jumpTo(h.sectionId);setIsHighlightsOpen(false)}}><p className={`border-l-4 pl-2 text-sm leading-6 ${h.color==='yellow'?'border-yellow-400':h.color==='blue'?'border-blue-400':h.color==='pink'?'border-pink-400':'border-green-400'}`}>{h.text}</p></button><textarea value={h.note} onChange={e=>updateHighlightNote(h.id,e.target.value)} placeholder="Add note to highlight…" rows={2} className="mt-2 w-full rounded-md border px-2 py-1.5 text-xs"/><button onClick={()=>deleteHighlight(h.id)} className="mt-2 text-[11px] text-red-500">Delete</button></div>)}</div></aside>}
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
                  {isFullStudy ? CAL_NEWPORT_FULL_STUDY[activeBookId].readingMinutes : activeBook.readingTime}
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

            {isFullStudy && <div className="px-5 sm:px-8 lg:px-12 py-7 sm:py-10" onMouseUp={captureSelection} style={{fontSize:`${fontScale}rem`,fontFamily,lineHeight}}>
              <section className={`${widthClass} mx-auto`}><div className="mb-8"><span className="inline-flex rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-semibold">Full Study Version · {CAL_NEWPORT_FULL_STUDY[activeBookId].readingMinutes}</span><h3 className="mt-4 text-2xl font-semibold">Extended Reading Companion</h3><div className="mt-4 space-y-4">{CAL_NEWPORT_FULL_STUDY[activeBookId].introduction.map((x,i)=><p key={i}>{x}</p>)}</div></div>
              <div className="space-y-8">{CAL_NEWPORT_FULL_STUDY[activeBookId].sections.map((section,i)=><section key={section.title} id={`full-${i}`} className="scroll-mt-32 border-t border-black/10 pt-7"><h3 className="text-xl font-semibold">{section.title}</h3><div className="mt-4 space-y-4">{section.reading.map((x,j)=><p key={j}>{x}</p>)}</div><h4 className="mt-6 text-sm font-semibold">Applications</h4><ul className="mt-2 space-y-2 text-sm">{section.applications.map(x=><li key={x}>• {x}</li>)}</ul><h4 className="mt-6 text-sm font-semibold">Practice & Action</h4><ol className="mt-2 space-y-2 text-sm">{section.exercises.map((x,j)=><li key={x}>{j+1}. {x}</li>)}</ol><h4 className="mt-6 text-sm font-semibold">Review Questions</h4><ol className="mt-2 space-y-2 text-sm">{section.review.map((x,j)=><li key={x} className="rounded-lg bg-black/[0.03] px-3 py-2">{j+1}. {x}</li>)}</ol></section>)}</div>
              <section className="mt-10 border-t border-black/10 pt-7"><h3 className="text-xl font-semibold">Final Review & 30-Day Transfer</h3><ol className="mt-4 space-y-3">{CAL_NEWPORT_FULL_STUDY[activeBookId].finalReview.map((x,i)=><li key={x}>{i+1}. {x}</li>)}</ol></section></section>
            </div>}

            {!isFullStudy &&             <div
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
                  );
                })}
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
            </div>}
          </article>
        </main>
      </div>
    </div>
  );
};
