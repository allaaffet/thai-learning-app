"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state surface" role="alert">
      <h1 className="page-title">画面を読み込めませんでした</h1>
      <p>もう一度お試しください。保存済みの進捗はブラウザ内に残っています。</p>
      <Button onClick={reset}>もう一度読み込む</Button>
    </div>
  );
}
