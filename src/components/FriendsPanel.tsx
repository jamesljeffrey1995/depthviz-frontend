import { useState, useEffect, useRef, useCallback } from 'react'
import { getFriends, getFriendRequests, respondToFriendRequest, removeFriend, sendFriendRequest, searchUsers } from '../lib/api'
import type { Friend, FriendRequest, UserSearchResult } from '../types'
import styles from './FriendsPanel.module.css'

interface FriendsPanelProps {
  onClose?: () => void
}

type Tab = 'friends' | 'requests' | 'find'

export function FriendsPanel({ onClose }: FriendsPanelProps) {
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load friends and requests on mount
  useEffect(() => {
    getFriends().then(setFriends).catch(() => {})
    getFriendRequests().then(setRequests).catch(() => {})
  }, [])

  // Debounced search
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      searchUsers(q.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 350)
  }, [])

  const handleAccept = async (id: number) => {
    await respondToFriendRequest(id, 'accepted').catch(() => {})
    setRequests(prev => prev.filter(r => r.id !== id))
    getFriends().then(setFriends).catch(() => {})
  }

  const handleDecline = async (id: number) => {
    await respondToFriendRequest(id, 'declined').catch(() => {})
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  const handleRemove = async (friendshipId: number) => {
    await removeFriend(friendshipId).catch(() => {})
    setFriends(prev => prev.filter(f => f.friendship_id !== friendshipId))
  }

  const handleAddFriend = async (uid: string) => {
    await sendFriendRequest(uid).catch(() => {})
    setSentIds(prev => new Set(prev).add(uid))
  }

  const friendUids = new Set(friends.map(f => f.uid))

  return (
    <div className={styles.panel}>
      {onClose && (
        <button className={styles.backBtn} onClick={onClose}>
          &#8592; Back
        </button>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'friends' ? styles.tabActive : ''}`}
          onClick={() => setTab('friends')}
        >
          Friends
        </button>
        <button
          className={`${styles.tab} ${tab === 'requests' ? styles.tabActive : ''}`}
          onClick={() => setTab('requests')}
        >
          Requests
          {requests.length > 0 && (
            <span className={styles.requestBadge}>{requests.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === 'find' ? styles.tabActive : ''}`}
          onClick={() => setTab('find')}
        >
          Find Divers
        </button>
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        <div>
          {friends.length === 0 && (
            <div className={styles.empty}>No friends yet — find divers to connect with!</div>
          )}
          {friends.map(f => (
            <div key={f.friendship_id} className={styles.friendCard}>
              <div className={styles.friendAvatar}>
                {(f.display_name ?? '?')[0].toUpperCase()}
              </div>
              <div className={styles.friendInfo}>
                <div className={styles.friendName}>{f.display_name}</div>
                <div className={styles.friendStats}>
                  {f.report_count} dive{f.report_count !== 1 ? 's' : ''}
                  {f.mean_accuracy != null && (
                    <span className={styles.accuracyBadge}>
                      &#177;{f.mean_accuracy.toFixed(1)}m
                    </span>
                  )}
                </div>
              </div>
              <button className={styles.btnRemove} onClick={() => handleRemove(f.friendship_id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {tab === 'requests' && (
        <div>
          {requests.length === 0 && (
            <div className={styles.empty}>No pending friend requests.</div>
          )}
          {requests.map(r => (
            <div key={r.id} className={styles.friendCard}>
              <div className={styles.friendAvatar}>
                {(r.from_name ?? '?')[0].toUpperCase()}
              </div>
              <div className={styles.friendInfo}>
                <div className={styles.friendName}>{r.from_name}</div>
              </div>
              <div className={styles.requestActions}>
                <button className={styles.btnAccept} onClick={() => handleAccept(r.id)}>
                  Accept
                </button>
                <button className={styles.btnDecline} onClick={() => handleDecline(r.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Find divers */}
      {tab === 'find' && (
        <div>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            autoFocus
          />
          {searching && <div className={styles.empty}>Searching...</div>}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <div className={styles.empty}>No divers found.</div>
          )}
          {searchResults.map(u => {
            const alreadyFriend = u.friendship_status === 'accepted' || friendUids.has(u.uid)
            const alreadyPending = u.friendship_status === 'pending' || sentIds.has(u.uid)
            return (
              <div key={u.uid} className={styles.userResult}>
                <div className={styles.friendAvatar}>
                  {(u.display_name ?? '?')[0].toUpperCase()}
                </div>
                <div className={styles.friendInfo}>
                  <div className={styles.friendName}>{u.display_name}</div>
                  <div className={styles.friendStats}>
                    {u.report_count} dive{u.report_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className={styles.btnAdd}
                  disabled={alreadyFriend || alreadyPending}
                  onClick={() => handleAddFriend(u.uid)}
                >
                  {alreadyFriend ? 'Friends' : alreadyPending ? 'Pending' : 'Add Friend'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
