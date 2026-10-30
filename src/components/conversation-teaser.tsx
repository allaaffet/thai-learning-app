import Link from "next/link";
import {
  ArrowRight,
  Coffee,
  MapPin,
  MessagesSquare,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { conversationScenarios } from "@/data/conversations";

export function ConversationTeaser() {
  return (
    <section
      className="conversation-teaser surface"
      aria-label="会話を練習する"
    >
      <div className="conversation-teaser-icons" aria-hidden="true">
        <MessagesSquare size={24} />
        <Coffee size={24} />
        <ShoppingBag size={24} />
        <MapPin size={24} />
      </div>
      <div className="conversation-teaser-copy">
        <p className="eyebrow">SMALL TALKS, SMALL STEPS</p>
        <h2>覚えたタイ語で、ひと言。</h2>
        <p>
          {conversationScenarios.length}
          つのシーンで、返答を選んでやりとり。ひとつ約3分。
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/conversations">
          シーンを選ぶ
          <ArrowRight size={17} />
        </Link>
      </Button>
    </section>
  );
}
