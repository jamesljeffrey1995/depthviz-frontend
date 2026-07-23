import { useState, useRef, useEffect, useCallback } from 'react'
import { formatLocationName } from '../types'
import type { GeocodingResult } from '../types'
import { IconSearch, IconLocate, IconArrowRight } from './icons'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  onSearch: (query: string) => void
  onLocate: () => void
  getSuggestions: (query: string) => Promise<GeocodingResult[]>
  onSelectSuggestion: (result: GeocodingResult) => void
}

export function SearchBar({ onSearch, onLocate, getSuggestions, onSelectSuggestion }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedResult, setSelectedResult] = useState<GeocodingResult | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = 'search-suggestions'

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setSelectedResult(null)
    setActiveIndex(-1)
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
    onSelectSuggestion(result)
  }, [onSelectSuggestion])

  const handleSubmit = useCallback(() => {
    setShowSuggestions(false)
    if (selectedResult) {
      onSelectSuggestion(selectedResult)
    } else {
      const trimmed = query.trim()
      // Guard against an empty/whitespace query — an empty string is a
      // substring of every saved location name, so passing it through would
      // match (and navigate to) an arbitrary location in App.handleSearch.
      if (trimmed) onSearch(trimmed)
    }
  }, [query, onSearch, onSelectSuggestion, selectedResult])

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
      <div className={styles.searchGroup}>
        <div className={styles.inputRow}>
          <IconSearch className={styles.inputIcon} aria-hidden="true" />
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
            placeholder="Search a coastal spot…"
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
        <button className={styles.btnDive} onClick={handleSubmit} aria-label="Search for this location">
          <span>Show forecast</span>
          <IconArrowRight aria-hidden="true" />
        </button>
      </div>
      <button className={styles.btnLocate} onClick={onLocate} aria-label="Use my current GPS location">
        <IconLocate aria-hidden="true" />
        <span>Use my current location</span>
      </button>
    </div>
  )
}
