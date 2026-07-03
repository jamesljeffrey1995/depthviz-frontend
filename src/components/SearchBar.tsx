import { useState, useRef, useEffect, useCallback } from 'react'
import { formatLocationName } from '../types'
import type { GeocodingResult } from '../types'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  /** Returns false when no matching location was found, so the bar can show
   *  an inline hint instead of failing silently. */
  onSearch: (query: string) => boolean | void | Promise<boolean | void>
  /** May reject (e.g. geolocation denied) — the bar shows a friendly inline
   *  error rather than a dead button. */
  onLocate: () => Promise<void> | void
  getSuggestions: (query: string) => Promise<GeocodingResult[]>
  onSelectSuggestion: (result: GeocodingResult) => void
}

export function SearchBar({ onSearch, onLocate, getSuggestions, onSelectSuggestion }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedResult, setSelectedResult] = useState<GeocodingResult | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [locating, setLocating] = useState(false)
  const [inlineError, setInlineError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = 'search-suggestions'

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setSelectedResult(null)
    setActiveIndex(-1)
    setInlineError('')
    clearTimeout(debounceRef.current)
    // Cancel any in-flight suggestion request
    abortRef.current?.abort()
    if (value.length < 3) { setSuggestions([]); setShowSuggestions(false); return }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const results = await getSuggestions(value)
        if (controller.signal.aborted) return // Stale — discard
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        // Aborted or failed — ignore
      }
    }, 300)
  }, [getSuggestions])

  const handleSelect = useCallback((result: GeocodingResult) => {
    const name = formatLocationName(result)
    setQuery(name)
    setSelectedResult(result)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
    setInlineError('')
    onSelectSuggestion(result)
  }, [onSelectSuggestion])

  const handleSubmit = useCallback(async () => {
    setShowSuggestions(false)
    setInlineError('')
    if (selectedResult) {
      onSelectSuggestion(selectedResult)
      return
    }
    if (!query.trim()) return
    let found: boolean | void
    try {
      found = await onSearch(query)
    } catch {
      setInlineError("Search didn't go through — check your connection and try again.")
      return
    }
    if (found === false) {
      setInlineError('No matching spot found — try a nearby beach, town or mark name.')
    }
  }, [query, onSearch, onSelectSuggestion, selectedResult])

  const handleLocate = useCallback(async () => {
    if (locating) return
    setInlineError('')
    setLocating(true)
    try {
      await onLocate()
    } catch {
      setInlineError("Couldn't get your position — check location permissions and try again, or search by name.")
    } finally {
      setLocating(false)
    }
  }, [locating, onLocate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleSubmit()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length && suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex])
      } else {
        handleSubmit()
      }
    }
  }, [showSuggestions, activeIndex, suggestions, handleSelect, handleSubmit])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="text"
          role="combobox"
          aria-label="Search for a coastal location"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search a coast, mark, beach or dive spot…"
          autoComplete="off"
        />
        {showSuggestions && (
          <ul
            id={listId}
            className={styles.suggestions}
            role="listbox"
            aria-label="Location suggestions"
          >
            {suggestions.map((r, i) => {
              const name = formatLocationName(r)
              return (
                <li
                  id={`suggestion-${i}`}
                  key={i}
                  className={`${styles.suggestion} ${i === activeIndex ? styles.suggestionActive : ''}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {name}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className={styles.buttonRow}>
        <button className={styles.btnDive} onClick={handleSubmit} aria-label="Check visibility for this location">Check visibility ›</button>
        <button
          className={styles.btnLocate}
          onClick={handleLocate}
          disabled={locating}
          aria-label="Use my current GPS location"
        >
          {locating ? 'Locating…' : '⊕ Use my location'}
        </button>
      </div>
      {inlineError && (
        <p className={styles.inlineError} role="alert">{inlineError}</p>
      )}
    </div>
  )
}
