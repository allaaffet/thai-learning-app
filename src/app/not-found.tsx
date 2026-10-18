import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="empty-state surface">
      <Compass size={40} />
      <p className="eyebrow">404 · PAGE NOT FOUND</p>
      <h1 className="page-title">このページは見つかりませんでした</h1>
      <p>学習ロードマップからレッスンを選び直してください。</p>
      <Button asChild>
        <Link href="/roadmap">ロードマップへ戻る</Link>
      </Button>
    </div>
  );
}
