"use client";

import Link from "next/link";
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
} from "lucide-react";
import { useLearning } from "@/components/learning-provider";
import { getStreak, getTotalXp } from "@/lib/progress";
import { courseLessons as lessons } from "@/data/course";
import { cn } from "@/lib/utils";
import { ThaiFontToggle } from "@/components/thai-font-toggle";

const navigation = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/roadmap", label: "学習ロードマップ", mobile: "学習", icon: Route },
  {
    href: "/characters",
    label: "タイ文字ノート",
    mobile: "文字",
    icon: BookOpen,
  },
  { href: "/writing", label: "書き取り練習", mobile: "書く", icon: PencilLine },
  {
    href: "/progress",
    label: "学習の記録",
    mobile: "記録",
    icon: ChartNoAxesCombined,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        <div className="nav-caption">MY LEARNING</div>
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
          <span className="mini-icon">
            <Compass size={19} />
          </span>
          <p>
            小さな一歩が、
            <br />
            新しい世界につながる。
          </p>
          <div className="sidebar-course-meta">
            <span>コースの進み具合</span>
            <strong>
              {ready ? completed : "–"} / {lessons.length}
            </strong>
          </div>
          <div className="track">
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
        <div className="sidebar-bottom">
          <Leaf size={15} />
          <span>自分のペースで、大丈夫。</span>
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
          <span className="topbar-label">
            <span className="status-dot" />
            日本語で学ぶ、タイ語の基礎
          </span>
          <ThaiFontToggle />
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
              <Leaf size={13} /> Phase 2 · ローカル保存
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
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
