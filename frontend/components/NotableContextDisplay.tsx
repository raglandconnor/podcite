import { useState } from "react";
import { researchStatements } from "@/lib/api";

interface NotableContextDisplayProps {
  context: any;
  isLoading: boolean;
  error: string | null;
}

export default function NotableContextDisplay({
  context,
  isLoading,
  error,
}: NotableContextDisplayProps) {
  const [researchResults, setResearchResults] = useState<any>(null);
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
    return null;
  }

  return (
    <div className='mt-6'>
      <h3 className='font-medium mb-3 text-lg'>Notable Context</h3>

      {isLoading && (
        <div className='bg-muted border border-border p-4 rounded-md'>
          <div className='text-primary text-sm'>
            Extracting notable context...
          </div>
        </div>
      )}

      {error && (
        <div className='bg-destructive/10 border border-destructive p-4 rounded-md'>
          <div className='text-destructive text-sm'>Error: {error}</div>
        </div>
      )}

      {selectedItem && (
        <div className='mb-4 p-3 bg-muted rounded-md border border-border'>
          <div className='flex items-center justify-between mb-2'>
            <div className='text-xs font-semibold text-foreground'>
              Researching:
            </div>
            <button
              onClick={() => {
                setSelectedItem(null);
                setResearchResults(null);
              }}
              className='text-muted-foreground hover:text-foreground text-xs'
            >
              Clear
            </button>
          </div>
          <div className='text-xs text-muted-foreground italic'>
            "{selectedItem}"
          </div>
        </div>
      )}

      {isResearching && (
        <div className='mb-4 bg-accent border border-border p-4 rounded-md'>
          <div className='text-accent-foreground text-sm'>
            Researching statement...
          </div>
        </div>
      )}

      {researchResults && (
        <div className='mb-4 bg-card border border-border rounded-md p-4 max-h-96 overflow-auto'>
          <div className='flex justify-between items-center mb-2'>
            <h4 className='font-semibold text-sm text-card-foreground'>
              Research Results
            </h4>
            <button
              onClick={() => setResearchResults(null)}
              className='text-muted-foreground hover:text-foreground text-xs'
            >
              Close
            </button>
          </div>
          <pre className='text-xs whitespace-pre-wrap break-words text-card-foreground'>
            {JSON.stringify(researchResults, null, 2)}
          </pre>
        </div>
      )}

      {context && !isLoading && (
        <div className='bg-card border border-border rounded-md p-4 space-y-3 max-h-96 overflow-y-auto'>
          {context.notable_context && Array.isArray(context.notable_context) ? (
            <div className='space-y-2'>
              {context.notable_context.map((item: string, index: number) => (
                <button
                  key={index}
                  onClick={() => handleResearch(item)}
                  disabled={isResearching}
                  className='w-full text-left px-4 py-3 bg-secondary hover:bg-secondary/80 border border-border rounded-md transition-colors text-sm text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>
              <pre className='whitespace-pre-wrap break-words text-xs text-card-foreground'>
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
