import { useState, useRef, useEffect, useCallback } from 'react'
import { formatLocationName } from '../types'
import type { GeocodingResult } from '../types'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setSelectedResult(null)
    clearTimeout(debounceRef.current)
    if (value.length < 3) { setSuggestions([]); setShowSuggestions(false); return }
    debounceRef.current = setTimeout(async () => {
      const results = await getSuggestions(value)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 300)
  }, [getSuggestions])

  const handleSelect = useCallback((result: GeocodingResult) => {
    const name = formatLocationName(result)
    setQuery(name)
    setSelectedResult(result)
    setSuggestions([])
    setShowSuggestions(false)
    onSelectSuggestion(result)
  }, [onSelectSuggestion])

  const handleSubmit = useCallback(() => {
    setShowSuggestions(false)
    if (selectedResult) {
      onSelectSuggestion(selectedResult)
    } else {
      onSearch(query)
    }
  }, [query, onSearch, onSelectSuggestion, selectedResult])

  // Clear debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
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
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter coastal location..."
          autoComplete="off"
        />
        {showSuggestions && (
          <ul className={styles.suggestions}>
            {suggestions.map((r, i) => {
              const name = formatLocationName(r)
              return (
                <li key={i} className={styles.suggestion} onClick={() => handleSelect(r)}>
                  {name}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className={styles.buttonRow}>
        <button className={styles.btnDive} onClick={handleSubmit}>DIVE ›</button>
        <button className={styles.btnLocate} onClick={onLocate}>⊕ USE MY LOCATION</button>
      </div>
    </div>
  )
}