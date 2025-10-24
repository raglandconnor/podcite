import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResearchItem } from "@/lib/api";
import { Loader2 } from "lucide-react";
import ResearchCard from "./ResearchCard";

interface ResearchPanelProps {
  items: ResearchItem[];
}

export default function ResearchPanel({ items }: ResearchPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const itemsJsonRef = useRef<string>("");

  // Detect manual scrolling and track near-bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 64;
      const nearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - threshold;
      setIsNearBottom(nearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    // Initialize near-bottom on mount
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to bottom when items change (new items or status updates)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const bottom = bottomRef.current;
    if (!container || !bottom || items.length === 0) return;

    // Serialize items to detect any changes (new items, status changes, result additions)
    const currentItemsJson = JSON.stringify(
      items.map((item) => ({
        id: item.id,
        status: item.status,
        hasResults: !!item.results,
      }))
    );

    // Only proceed if items actually changed
    if (itemsJsonRef.current === currentItemsJson) return;
    itemsJsonRef.current = currentItemsJson;

    // If near bottom, scroll to maintain bottom position
    if (isNearBottom) {
      requestAnimationFrame(() => {
        bottom.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [items, isNearBottom]);

  const completedCount = items.filter(
    (item) => item.status === "completed"
  ).length;
  const researchingCount = items.filter(
    (item) => item.status === "researching"
  ).length;
  const pendingCount = items.filter((item) => item.status === "pending").length;

  if (items.length === 0) {
    return (
      <Card className='h-full'>
        <CardHeader>
          <CardTitle>Research</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground text-center py-8'>
            Research will appear here as context is extracted and when you
            select text to research manually.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleJumpToLive = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
      setIsNearBottom(true);
    }
  };

  return (
    <Card className='flex flex-col overflow-hidden max-h-[calc(100vh-14rem)]'>
      <CardHeader className='flex-shrink-0'>
        <div className='flex items-center justify-between gap-2'>
          <CardTitle className='text-base'>Research</CardTitle>
          <div className='flex items-center gap-1.5 flex-wrap'>
            {researchingCount > 0 && (
              <Badge variant='secondary' className='text-xs'>
                <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                {researchingCount}
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant='outline' className='text-xs'>
                Pending {pendingCount}
              </Badge>
            )}
            <Badge variant='outline' className='text-xs'>
              {completedCount} / {items.length}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className='flex-1 relative flex flex-col min-h-0 p-0 overflow-hidden'>
        <div ref={scrollContainerRef} className='flex-1 overflow-y-auto px-6'>
          <div className='space-y-1.5 pt-2'>
            {items.map((item, index) => {
              const isLastCompleted =
                item.status === "completed" &&
                index === items.findLastIndex((i) => i.status === "completed");

              return (
                <ResearchCard
                  key={item.id}
                  item={item}
                  defaultOpen={isLastCompleted}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {!isNearBottom && items.length > 0 && (
          <div className='absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none'>
            <Button
              size='sm'
              onClick={handleJumpToLive}
              className='pointer-events-auto shadow-lg'
            >
              Jump to live
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
