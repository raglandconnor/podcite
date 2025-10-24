import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResearchItem } from "@/lib/api";
import { Loader2 } from "lucide-react";
import ResearchCard from "./ResearchCard";

interface ResearchPanelProps {
  items: ResearchItem[];
}

export default function ResearchPanel({ items }: ResearchPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new items are added
  useEffect(() => {
    if (bottomRef.current && items.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [items.length]);

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

  return (
    <Card className='h-full flex flex-col overflow-hidden'>
      <CardHeader className='sticky top-0 bg-background z-10'>
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

      <ScrollArea className='flex-1'>
        <CardContent className='space-y-1.5'>
          {items.map((item) => (
            <ResearchCard key={item.id} item={item} defaultOpen={true} />
          ))}
          <div ref={bottomRef} />
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
