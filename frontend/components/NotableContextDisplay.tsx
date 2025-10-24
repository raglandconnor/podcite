import { useState } from "react";
import { researchStatements } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotableContextDisplayProps {
  context: { notable_context?: string[] } | null;
  isLoading: boolean;
  error: string | null;
}

export default function NotableContextDisplay({
  context,
  isLoading,
  error,
}: NotableContextDisplayProps) {
  const [researchResults, setResearchResults] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const handleResearch = async (item: string) => {
    setSelectedItem(item);
    setIsResearching(true);
    setResearchResults(null);

    try {
      const results = await researchStatements([item]);
      setResearchResults(results);
    } catch (error) {
      console.error("Research failed:", error);
      setResearchResults({ error: String(error) });
    } finally {
      setIsResearching(false);
    }
  };

  if (!context && !isLoading && !error) {
    return (
      <Card>
        <CardContent>
          <p className='text-sm text-muted-foreground text-center py-8'>
            Context will appear as the episode plays...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className='space-y-4'>
        {isLoading && (
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>Extracting context...</Badge>
          </div>
        )}

        {error && (
          <div className='text-sm text-destructive border border-destructive/20 rounded-md p-3'>
            Error: {error}
          </div>
        )}

        {selectedItem && (
          <Card className='border-primary/20'>
            <CardContent className='pt-4'>
              <div className='flex items-center justify-between mb-2'>
                <Badge variant='outline'>Researching</Badge>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setSelectedItem(null);
                    setResearchResults(null);
                  }}
                >
                  Clear
                </Button>
              </div>
              <p className='text-xs text-muted-foreground italic'>
                &quot;{selectedItem}&quot;
              </p>
            </CardContent>
          </Card>
        )}

        {isResearching && (
          <Badge variant='secondary'>Researching statement...</Badge>
        )}

        {researchResults && (
          <Card>
            <CardContent className='pt-4'>
              <div className='flex justify-between items-center mb-2'>
                <h4 className='font-semibold text-sm'>Research Results</h4>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setResearchResults(null)}
                >
                  Close
                </Button>
              </div>
              <ScrollArea className='h-96'>
                <pre className='text-xs whitespace-pre-wrap break-words'>
                  {JSON.stringify(researchResults, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {context && !isLoading && (
          <ScrollArea className='h-96'>
            {context.notable_context &&
            Array.isArray(context.notable_context) ? (
              <div className='space-y-2'>
                {context.notable_context.map((item: string, index: number) => (
                  <Button
                    key={index}
                    variant='secondary'
                    className='w-full justify-start text-left whitespace-normal break-words h-auto py-3 px-4'
                    onClick={() => handleResearch(item)}
                    disabled={isResearching}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            ) : (
              <pre className='text-xs whitespace-pre-wrap break-words'>
                {JSON.stringify(context, null, 2)}
              </pre>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
