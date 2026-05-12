import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

interface SearchAndCreateBarProps {
  searchQuery: string
  inputValue: string
  setInputValue: (query: string) => void
  handleSearch: () => void
  handleResetSearch: () => void
}

export default function SearchAndCreateBar({
  searchQuery,
  inputValue,
  setInputValue,
  handleSearch,
  handleResetSearch,
}: SearchAndCreateBarProps) {
  return (
    <div className="mx-auto mb-8 w-full max-w-2xl">
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-5 h-5 w-5 text-slate-500" />
        <Input
          type="text"
          placeholder="문서 검색"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch()
            }
          }}
          className="h-12 rounded-full border-slate-200 bg-white pr-12 pl-14 text-base shadow-sm transition-colors placeholder:text-slate-500 focus:bg-white"
        />
        {searchQuery ? (
          <Button
            onClick={handleResetSearch}
            variant="ghost"
            size="sm"
            className="-translate-y-1/2 absolute top-1/2 right-2 h-8 w-8 rounded-full p-0 text-slate-500 hover:bg-slate-100"
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
