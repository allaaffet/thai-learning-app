"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  CircleHelp,
  Compass,
  Flame,
  House,
  Leaf,
  PencilLine,
  Route,
  Sparkles,
  Waves,
  BookText,
  Languages,
  RotateCcw,
  Gamepad2,
  MessagesSquare,
} from "lucide-react";
import { useLearning } from "@/components/learning-provider";
import { getStreak, getTotalXp } from "@/lib/progress";
import { courseLessons as lessons } from "@/data/course";
import { cn } from "@/lib/utils";
import { ThaiFontToggle } from "@/components/thai-font-toggle";
import { SoundSettings } from "@/components/sound-settings";

const navigation = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/roadmap", label: "学習ロードマップ", mobile: "学習", icon: Route },
  {
    href: "/characters",
    label: "タイ文字ノート",
    mobile: "文字",
    icon: BookOpen,
  },
  {
    href: "/character-practice",
    label: "文字トレーニング",
    mobile: "字トレ",
    icon: Gamepad2,
  },
  { href: "/writing", label: "書き取り練習", mobile: "書く", icon: PencilLine },
  {
    href: "/pronunciation",
    label: "発音・声調ラボ",
    mobile: "発音",
    icon: Waves,
  },
  {
    href: "/vocabulary",
    label: "単語帳",
    mobile: "単語",
    icon: Languages,
  },
  {
    href: "/grammar",
    label: "文法リファレンス",
    mobile: "文法",
    icon: BookText,
  },
  {
    href: "/review",
    label: "単語の復習",
    mobile: "復習",
    icon: RotateCcw,
  },
  {
    href: "/conversations",
    label: "会話ミッション",
    mobile: "会話",
    icon: MessagesSquare,
  },
  {
    href: "/progress",
    label: "学習の記録",
    mobile: "記録",
    icon: ChartNoAxesCombined,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mobileNavigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = mobileNavigation.current;
    const active = nav?.querySelector<HTMLAnchorElement>("a.active");
    if (!nav || !active || nav.clientWidth === 0) return;
    if (
      active.offsetLeft < nav.scrollLeft ||
      active.offsetLeft + active.offsetWidth > nav.scrollLeft + nav.clientWidth
    ) {
      nav.scrollLeft = Math.max(
        0,
        active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2,
      );
    }
  }, [pathname]);
  const { progress, ready, storageMessage } = useLearning();
  const completed = lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completedAt,
  ).length;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        本文へスキップ
      </a>
      <aside className="sidebar" aria-label="メインナビゲーション">
        <Link href="/" className="brand" aria-label="Thai Learning ホーム">
          <span className="brand-mark thai" lang="th">
            ก
          </span>
          <span>
            Thai<span className="brand-light"> Learning</span>
            <small>タイ語を、ひとつずつ。</small>
          </span>
        </Link>
        <div className="nav-caption">学習メニュー</div>
        <nav className="desktop-nav">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-link",
                (pathname === href ||
                  (href === "/roadmap" && pathname.startsWith("/lessons/"))) &&
                  "active",
              )}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
              {pathname === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-course">
          <div className="sidebar-course-heading">
            <Compass size={19} aria-hidden="true" />
            <span>コースの進捗</span>
          </div>
          <strong className="sidebar-course-value">
            {ready ? completed : "–"} <small>/ {lessons.length}</small>
          </strong>
          <div
            className="track"
            role="progressbar"
            aria-label="コースの完了レッスン数"
            aria-valuemin={0}
            aria-valuemax={lessons.length}
            aria-valuenow={ready ? completed : undefined}
          >
            <span
              style={{
                width: `${ready ? (completed / lessons.length) * 100 : 0}%`,
              }}
            />
          </div>
          <Link href="/roadmap">
            カリキュラムを見る <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <span className="brand-mark thai" lang="th">
              ก
            </span>
            <span>Thai Learning</span>
          </Link>
          <div className="topbar-controls">
            <ThaiFontToggle />
            <SoundSettings />
          </div>
          <div className="topbar-stats">
            <span title="連続学習日数">
              <Flame size={17} />
              <strong>{ready ? getStreak(progress) : "–"}</strong>
              <span className="stat-unit">日</span>
            </span>
            <span title="獲得XP">
              <Sparkles size={17} />
              <strong>{ready ? getTotalXp(progress) : "–"}</strong>
              <span className="stat-unit">XP</span>
            </span>
            <span className="user-avatar" aria-label="ローカル学習モード">
              学
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {storageMessage && (
            <div className="storage-notice" role="status">
              <CircleHelp size={18} />
              <span>{storageMessage} 進捗はこのブラウザ内に保存されます。</span>
            </div>
          )}
          {children}
          <footer className="page-footer">
            <span>
              Thai Learning <span className="footer-dot">·</span>{" "}
              学ぶ楽しさを、毎日に。
            </span>
            <span>
              <Leaf size={13} /> このブラウザに保存
            </span>
          </footer>
        </main>
      </div>
      <nav
        ref={mobileNavigation}
        className="mobile-nav"
        aria-label="モバイルナビゲーション"
      >
        {navigation.map(({ href, label, mobile, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              (pathname === href ||
                (href === "/roadmap" && pathname.startsWith("/lessons/"))) &&
                "active",
            )}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{mobile ?? label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
