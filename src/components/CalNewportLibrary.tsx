import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Coffee,
  Lightbulb,
  Minus,
  Plus,
  Target,
} from 'lucide-react';
import { DashboardTheme } from '../types';
import {
  CAL_NEWPORT_BOOKS,
  CAL_NEWPORT_LIBRARY_UPDATED,
  CalNewportBook,
} from '../data/calNewportLibrary';

type ReaderTone = 'paper' | 'sepia' | 'night';

interface CalNewportLibraryProps {
  theme: DashboardTheme;
  onBack: () => void;
}

const ACTIVE_BOOK_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_ACTIVE_BOOK';
const FONT_SCALE_KEY = 'SYSTEM_BUILDER_CAL_NEWPORT_FONT_SCALE';

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
  const readerTone: ReaderTone = 'sepia';
  const [readingProgress, setReadingProgress] = useState(0);

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

  const toneClasses =
    readerTone === 'night'
      ? 'bg-[#111315] text-[#ece8df]'
      : readerTone === 'sepia'
      ? 'bg-[#f4ecd8] text-[#3f3426]'
      : 'bg-[#f7f5ef] text-[#202124]';

  const cardClasses =
    readerTone === 'night'
      ? 'bg-[#191c1f] border-[#2b3035]'
      : readerTone === 'sepia'
      ? 'bg-[#fbf4e3] border-[#ded0b4]'
      : 'bg-[#fffefb] border-[#dedbd2]';

  const mutedText =
    readerTone === 'night'
      ? 'text-slate-400'
      : readerTone === 'sepia'
      ? 'text-[#766653]'
      : 'text-slate-500';

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

      <header
        className={`sticky top-0 z-[60] border-b backdrop-blur-xl ${
          readerTone === 'night'
            ? 'bg-[#111315]/95 border-[#2b3035]'
            : readerTone === 'sepia'
            ? 'bg-[#f4ecd8]/95 border-[#ded0b4]'
            : 'bg-[#f7f5ef]/95 border-[#dedbd2]'
        }`}
      >
        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-3 flex items-center justify-between gap-3">
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
                <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
                  By Cal Newport
                </h1>
              </div>
              <p className={`text-[11px] sm:text-xs font-semibold ${mutedText}`}>
                Practical reading library • Updated {CAL_NEWPORT_LIBRARY_UPDATED}
              </p>
            </div>
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

            <div
              className="flex items-center rounded-xl border border-[#ded0b4] p-1"
              title="Sepia reading theme"
              aria-label="Sepia reading theme"
            >
              <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-700 text-white">
                <Coffee className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {CAL_NEWPORT_BOOKS.map((book, index) => (
              <button
                key={book.id}
                type="button"
                onClick={() => selectBook(book)}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
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
      </header>

      <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-5 lg:py-7">
        <main className="min-w-0">
          <article
            className={`rounded-[24px] border shadow-[0_20px_55px_rgba(15,23,42,0.08)] overflow-hidden ${cardClasses}`}
          >
            <div
              className={`px-5 sm:px-8 lg:px-12 py-8 sm:py-10 border-b ${
                readerTone === 'night' ? 'border-[#2b3035]' : 'border-black/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-1 text-[11px] font-black">
                  {activeBook.year}
                </span>
                <span className={`text-[11px] font-bold ${mutedText}`}>
                  {activeBook.readingTime}
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.04]">
                {activeBook.title}
              </h2>
              <p className="mt-3 text-base sm:text-lg font-black text-blue-600">
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
              style={{
                fontSize: `${fontScale}rem`,
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              <section className="max-w-[820px] mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3
                    className="text-xl sm:text-2xl font-black"
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
                    className="text-xl sm:text-2xl font-black"
                    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                  >
                    Key Themes
                  </h3>
                </div>

                <div className="space-y-5">
                  {activeBook.themes.map((themeItem, themeIndex) => (
                    <details
                      key={themeItem.title}
                      open={themeIndex === 0}
                      className={`group rounded-2xl border overflow-hidden ${
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
                            className="text-base sm:text-lg font-black leading-snug"
                            style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                          >
                            {themeItem.title}
                          </h4>
                          <p className={`mt-1 text-sm leading-6 font-semibold ${mutedText}`}>
                            {themeItem.shortIdea}
                          </p>
                        </div>
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
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
                                className="text-[11px] uppercase tracking-[0.14em] font-black text-blue-600"
                                style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                              >
                                Real-world example {index + 1}
                              </div>
                              <h5
                                className="mt-1 text-sm font-black"
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
                            className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-300"
                            style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                          >
                            <Target className="w-4 h-4" />
                            Key Action Plan
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {themeItem.actionPlan.map((step, index) => (
                              <div key={step} className="flex items-start gap-2.5">
                                <span
                                  className="w-5 h-5 mt-0.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0"
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

              <section className="max-w-[820px] mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked className="w-5 h-5 text-violet-600" />
                  <h3
                    className="text-xl sm:text-2xl font-black"
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
                  className={`mt-7 rounded-2xl border p-5 ${
                    readerTone === 'night'
                      ? 'border-blue-900/50 bg-blue-950/20'
                      : 'border-blue-200 bg-blue-50/80'
                  }`}
                >
                  <div
                    className="flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300"
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
                          className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0"
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
