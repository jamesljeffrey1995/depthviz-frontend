import { useState, useRef, useEffect, useCallback, useId } from 'react'
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
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const listId = `${inputId}-suggestions`
  const helpId = `${inputId}-help`
  const statusId = `${inputId}-status`

  const resetSuggestions = useCallback(() => {
    clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
    setLoadingSuggestions(false)
    setSuggestionsError(false)
  }, [])

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setSelectedResult(null)
    resetSuggestions()
    const trimmed = value.trim()
    if (trimmed.length < 3) return
    setLoadingSuggestions(true)
    setShowSuggestions(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const results = await getSuggestions(trimmed)
        if (controller.signal.aborted) return
        setSuggestions(results)
        setShowSuggestions(true)
      } catch {
        if (controller.signal.aborted) return
        setSuggestionsError(true)
        setShowSuggestions(true)
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false)
      }
    }, 300)
  }, [getSuggestions, resetSuggestions])

  const handleSelect = useCallback((result: GeocodingResult) => {
    const name = formatLocationName(result)
    setQuery(name)
    setSelectedResult(result)
    resetSuggestions()
    onSelectSuggestion(result)
  }, [onSelectSuggestion, resetSuggestions])

  const handleSubmit = useCallback(() => {
    resetSuggestions()
    if (selectedResult) {
      onSelectSuggestion(selectedResult)
    } else {
      const trimmed = query.trim()
      // Guard against an empty/whitespace query — an empty string is a
      // substring of every saved location name, so passing it through would
      // match (and navigate to) an arbitrary location in App.handleSearch.
      if (trimmed) onSearch(trimmed)
    }
  }, [query, onSearch, onSelectSuggestion, resetSuggestions, selectedResult])

  const handleClear = useCallback(() => {
    setQuery('')
    setSelectedResult(null)
    resetSuggestions()
    inputRef.current?.focus()
  }, [resetSuggestions])

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

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const trimmedQuery = query.trim()
  const canSuggest = trimmedQuery.length >= 3
  const statusMessage = !trimmedQuery
    ? ''
    : !canSuggest
      ? 'Type at least 3 characters to see suggestions.'
      : loadingSuggestions
        ? 'Looking up matching places…'
        : suggestionsError
          ? 'Suggestions are unavailable right now. You can still submit your search.'
          : suggestions.length === 0
            ? 'No matching places found yet. You can still submit your search.'
            : `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available. Use the arrow keys to choose one.`

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.searchGroup}>
        <div className={styles.inputRow}>
          <IconSearch className={styles.inputIcon} aria-hidden="true" />
          <input
            id={inputId}
            ref={inputRef}
            className={styles.input}
            type="text"
            role="combobox"
            aria-label="Search for a coastal location"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            aria-controls={showSuggestions ? listId : undefined}
            aria-activedescendant={showSuggestions && activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
            aria-describedby={statusMessage ? `${helpId} ${statusId}` : helpId}
            aria-busy={loadingSuggestions}
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search a place"
            autoComplete="off"
          />
          {query && (
            <button type="button" className={styles.clearBtn} onClick={handleClear} aria-label="Clear location search">
              Clear
            </button>
          )}
          {showSuggestions && (
            <ul
              id={listId}
              className={styles.suggestions}
              role="listbox"
              aria-label="Location suggestions"
            >
              {loadingSuggestions ? (
                <li className={styles.suggestionMessage} role="option" aria-disabled="true">Looking up matching places…</li>
              ) : suggestionsError ? (
                <li className={styles.suggestionMessage} role="option" aria-disabled="true">Suggestions are unavailable right now.</li>
              ) : suggestions.length === 0 ? (
                <li className={styles.suggestionMessage} role="option" aria-disabled="true">No matching places found.</li>
              ) : (
                suggestions.map((r, i) => {
                  const name = formatLocationName(r)
                  return (
                    <li
                      id={`suggestion-${i}`}
                      key={`${r.latitude}:${r.longitude}:${name}`}
                      className={`${styles.suggestion} ${i === activeIndex ? styles.suggestionActive : ''}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      {name}
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </div>
        <button type="button" className={styles.btnDive} onClick={handleSubmit} aria-label="Show forecast">
          <span>Show forecast</span>
          <IconArrowRight aria-hidden="true" />
        </button>
      </div>
      <button type="button" className={styles.btnLocate} onClick={onLocate} aria-label="Use my current GPS location">
        <IconLocate aria-hidden="true" />
        <span>Use my current location</span>
      </button>
      <div className={styles.meta}>
        <p id={helpId} className={styles.helper}>Search by town, beach, headland, or coordinates.</p>
        <p id={statusId} className={styles.status} aria-live="polite">{statusMessage}</p>
      </div>
    </div>
  )
}
