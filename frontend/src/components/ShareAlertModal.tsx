import { useState, useEffect } from 'react'
import { X, Send, Loader2, Users, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { socialService } from '@/services/socialService'
import { apiErrorMessage } from '@/services/api'
import type { User as UserType, SafetyGroup } from '@/types'

interface ShareAlertModalProps {
  isOpen: boolean
  onClose: () => void
  scanId: number
}

export default function ShareAlertModal({ isOpen, onClose, scanId }: ShareAlertModalProps) {
  const toast = useToast()
  const [selectedFriends, setSelectedFriends] = useState<number[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [sharing, setSharing] = useState(false)

  // Fetch friends and groups only when modal is open
  const { data: friends = [], loading: loadingFriends } = useAsync<UserType[]>(
    () => (isOpen ? socialService.getFriends() : Promise.resolve([])),
    [isOpen]
  )

  const { data: groups = [], loading: loadingGroups } = useAsync<SafetyGroup[]>(
    () => (isOpen ? socialService.getGroups() : Promise.resolve([])),
    [isOpen]
  )

  // Reset state when closing/opening
  useEffect(() => {
    if (isOpen) {
      setSelectedFriends([])
      setSelectedGroups([])
      setNote('')
      setSharing(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const loading = loadingFriends || loadingGroups
  const friendsList = friends || []
  const groupsList = groups || []
  const canShare = selectedFriends.length > 0 || selectedGroups.length > 0

  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    if (!canShare) return

    setSharing(true)
    try {
      const response = await socialService.shareThreatAlert({
        scan_id: scanId,
        friend_ids: selectedFriends,
        group_ids: selectedGroups,
        note: note.trim(),
      })
      toast.success(response.message || 'Alert shared successfully!')
      onClose()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not share alert.'))
    } finally {
      setSharing(false)
    }
  }

  function toggleFriend(id: number) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function toggleGroup(id: number) {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-abyss p-6 shadow-2xl animate-scale-in z-10 text-ink">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline/60 pb-4 mb-4">
          <h3 className="text-md font-semibold text-ink">Share Fraud Alert</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-faint hover:bg-white/5 hover:text-ink transition"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-faint">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">Loading your circle...</p>
          </div>
        ) : (
          <form onSubmit={handleShare} className="space-y-5">
            <p className="text-[13px] text-ink-muted leading-relaxed">
              Alert your friends or safety groups immediately about this threat.
            </p>

            {/* Friends list */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Share with Friends
              </label>
              {friendsList.length === 0 ? (
                <p className="text-xs text-ink-faint py-1">No active friends found. Add friends in the Safety Circle tab first.</p>
              ) : (
                <div className="max-h-28 overflow-y-auto space-y-2 border border-hairline bg-surface/10 rounded-xl p-3 scrollbar-none">
                  {friendsList.map((friend) => (
                    <label
                      key={friend.id}
                      className="flex items-center gap-3 py-1 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFriends.includes(friend.id)}
                        onChange={() => toggleFriend(friend.id)}
                        className="rounded border-hairline bg-surface text-cyan-400 focus:ring-cyan-400"
                      />
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 text-ink-faint" />
                        <span className="font-medium text-ink truncate max-w-[200px]">{friend.name}</span>
                        <span className="text-[11px] text-ink-faint truncate max-w-[120px]">({friend.email})</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Groups list */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Share with Safety Groups
              </label>
              {groupsList.length === 0 ? (
                <p className="text-xs text-ink-faint py-1">No groups found. Create a group in the Safety Circle tab first.</p>
              ) : (
                <div className="max-h-28 overflow-y-auto space-y-2 border border-hairline bg-surface/10 rounded-xl p-3 scrollbar-none">
                  {groupsList.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-3 py-1 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        className="rounded border-hairline bg-surface text-cyan-400 focus:ring-cyan-400"
                      />
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-3.5 w-3.5 text-ink-faint" />
                        <span className="font-medium text-ink truncate max-w-[220px]">{group.name}</span>
                        <span className="text-[10px] text-ink-faint uppercase tracking-wider">
                          ({group.members.length} member{group.members.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Warning Note */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Add Warning Message (Optional)
              </label>
              <Textarea
                placeholder="e.g. Warning: I received this SMS today claiming my account is blocked. Do not click it!"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="text-sm border-hairline bg-surface/30 focus:border-cyan-400"
                disabled={sharing}
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 justify-end pt-2 border-t border-hairline/40">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={sharing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 flex items-center gap-2"
                disabled={sharing || !canShare}
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Share Alert
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
