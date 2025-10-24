import { useState } from "react";
import { ResearchItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";

interface ResearchCardProps {
  item: ResearchItem;
  defaultOpen?: boolean;
}

const getVerdictColor = (
  verdict: "verified" | "refuted" | "inconclusive" | "partial"
) => {
  switch (verdict) {
    case "verified":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "refuted":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    case "partial":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "inconclusive":
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

const getSourceIcon = (type: "arxiv" | "web" | "legislation") => {
  switch (type) {
    case "arxiv":
      return "📄";
    case "web":
      return "🌐";
    case "legislation":
      return "🏛️";
  }
};

export default function ResearchCard({
  item,
  defaultOpen = true,
}: ResearchCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className='border rounded-lg bg-white shadow-sm'>
      {/* Header */}
      <div className='p-3 flex items-start gap-2'>
        <div className='flex-1 min-w-0'>
          {/* Badges Row */}
          <div className='flex items-center gap-1.5 mb-2'>
            {/* Type Badge */}
            <Badge
              variant={item.type === "manual" ? "default" : "secondary"}
              className='text-xs'
            >
              {item.type === "manual" ? "Manual" : "Auto"}
            </Badge>

            {/* Verdict Badge */}
            {item.status === "completed" && item.results && (
              <Badge
                variant='outline'
                className={`${getVerdictColor(item.results.verdict)} text-xs`}
              >
                {item.results.verdict.toUpperCase()}
              </Badge>
            )}

            {/* Researching Badge */}
            {item.status === "researching" && (
              <Badge variant='secondary' className='text-xs'>
                <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                Researching...
              </Badge>
            )}

            {/* Pending Badge */}
            {item.status === "pending" && (
              <Badge variant='outline' className='text-xs'>
                Pending
              </Badge>
            )}
          </div>

          {/* Question */}
          <p className='text-sm font-medium text-gray-900 leading-tight'>
            {item.question}
          </p>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className='flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors'
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? (
            <ChevronUp className='w-4 h-4 text-gray-600' />
          ) : (
            <ChevronDown className='w-4 h-4 text-gray-600' />
          )}
        </button>
      </div>

      {/* Collapsible Content */}
      {isOpen &&
        (item.status === "error" ||
          (item.status === "completed" && item.results)) && (
          <div className='px-3 pb-3 border-t border-gray-100'>
            <div className='pt-2 space-y-2'>
              {/* Error State */}
              {item.status === "error" && (
                <div className='text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2'>
                  {item.error}
                </div>
              )}

              {/* Completed Results */}
              {item.status === "completed" && item.results && (
                <>
                  {/* Summary */}
                  <p className='text-xs text-gray-600 leading-snug'>
                    {item.results.summary}
                  </p>

                  {/* Sources */}
                  {item.results.sources.length > 0 && (
                    <div className='flex flex-wrap gap-2 pt-1'>
                      {item.results.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline group'
                        >
                          <span>{getSourceIcon(source.type)}</span>
                          <span className='truncate max-w-[180px]'>
                            {source.title}
                          </span>
                          <ExternalLink className='w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity' />
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
