import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus,
  Users,
  Check,
  X,
  Trash2,
  Plus,
  Shield,
  Loader2,
  Mail,
  UserMinus,
  Clock,
  ArrowRight,
  ShieldAlert,
  Send,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/PageHeader'
import { StatTile } from '@/components/StatTile'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { socialService } from '@/services/socialService'
import { apiErrorMessage } from '@/services/api'
import { formatDateTime } from '@/lib/format'
import type { User, Friendship, SafetyGroup, ThreatAlert } from '@/types'

const RISK_ACCENT: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
}

export default function SocialCircle() {
  const toast = useToast()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'network' | 'groups' | 'history'>('network')

  // Email state for sending requests
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Group creation state
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Group members manage state
  const [addingMemberToGroup, setAddingMemberToGroup] = useState<Record<number, boolean>>({})
  const [selectedFriendForGroup, setSelectedFriendForGroup] = useState<Record<number, string>>({})

  // Fetch friends list
  const {
    data: friends = [],
    loading: loadingFriends,
    reload: reloadFriends,
  } = useAsync<User[]>(() => socialService.getFriends(), [])

  // Fetch pending requests
  const {
    data: requests = [],
    reload: reloadRequests,
  } = useAsync<Friendship[]>(() => socialService.getPendingRequests(), [])

  // Fetch groups
  const {
    data: groups = [],
    loading: loadingGroups,
    reload: reloadGroups,
  } = useAsync<SafetyGroup[]>(() => socialService.getGroups(), [])

  // Fetch alerts history (unread_only = false)
  const {
    data: alertsHistory = [],
    loading: loadingHistory,
  } = useAsync<ThreatAlert[]>(() => socialService.getThreatAlerts(false), [])

  // Actions: Send Invite
  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setSendingInvite(true)
    try {
      await socialService.sendFriendRequest(inviteEmail)
      toast.success(`Friend request sent to ${inviteEmail}`)
      setInviteEmail('')
      reloadRequests()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not send friend request.'))
    } finally {
      setSendingInvite(false)
    }
  }

  // Actions: Accept Request
  async function handleAccept(request: Friendship) {
    try {
      await socialService.acceptFriendRequest(request.id)
      toast.success(`Friend request accepted`)
      reloadRequests()
      reloadFriends()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not accept friend request.'))
    }
  }

  // Actions: Reject Request
  async function handleReject(request: Friendship) {
    try {
      await socialService.rejectFriendRequest(request.id)
      toast.success(`Friend request declined`)
      reloadRequests()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not decline friend request.'))
    }
  }

  // Actions: Cancel/Remove connection
  async function handleRemoveConnection(friendshipId: number, name: string) {
    const confirmed = window.confirm(`Remove ${name} from your safety circle?`)
    if (!confirmed) return

    try {
      await socialService.removeFriend(friendshipId)
      toast.success(`Friend connection removed`)
      reloadRequests()
      reloadFriends()
      reloadGroups() // Groups members might change
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not remove connection.'))
    }
  }

  // Actions: Create Group
  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setCreatingGroup(true)
    try {
      await socialService.createGroup(newGroupName)
      toast.success(`Group "${newGroupName}" created`)
      setNewGroupName('')
      reloadGroups()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not create safety group.'))
    } finally {
      setCreatingGroup(false)
    }
  }

  // Actions: Add Member to Group
  async function handleAddMember(groupId: number) {
    const friendIdStr = selectedFriendForGroup[groupId]
    if (!friendIdStr) return

    const friendId = parseInt(friendIdStr)
    setAddingMemberToGroup((prev) => ({ ...prev, [groupId]: true }))

    try {
      await socialService.addGroupMember(groupId, friendId)
      toast.success(`Member added successfully`)
      // Clear dropdown selection
      setSelectedFriendForGroup((prev) => ({ ...prev, [groupId]: '' }))
      reloadGroups()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not add group member.'))
    } finally {
      setAddingMemberToGroup((prev) => ({ ...prev, [groupId]: false }))
    }
  }

  // Actions: Remove Member from Group
  async function handleRemoveMember(groupId: number, memberId: number, memberName: string) {
    const isSelf = memberId === user?.id
    const message = isSelf ? 'Leave this safety group?' : `Remove ${memberName} from this group?`
    const confirmed = window.confirm(message)
    if (!confirmed) return

    try {
      await socialService.removeGroupMember(groupId, memberId)
      toast.success(isSelf ? 'Left the group' : 'Member removed')
      reloadGroups()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not remove group member.'))
    }
  }

  // Actions: Delete Group
  async function handleDeleteGroup(groupId: number, groupName: string) {
    const confirmed = window.confirm(`Delete safety group "${groupName}"?`)
    if (!confirmed) return

    try {
      await socialService.deleteGroup(groupId)
      toast.success(`Group "${groupName}" deleted`)
      reloadGroups()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'Could not delete group.'))
    }
  }

  // Safe checks for potentially null async-loaded data
  const requestsList = requests || []
  const friendsList = friends || []
  const groupsList = groups || []
  const alertsHistoryList = alertsHistory || []

  // Categorize requests into incoming and outgoing
  const incomingRequests = requestsList.filter((r) => r.friend_id === user?.id)
  const outgoingRequests = requestsList.filter((r) => r.user_id === user?.id)

  const newRequestsCount = incomingRequests.length

  return (
    <div className="space-y-8">
      <PageHeader
        title="Social Safety Circle"
        description="Collaborate with your friends and family. Share warnings and alerts about fraud links, scams, or tampered documents instantly."
      />

      {/* Cyber Stat Tiles Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Active Network"
          value={friendsList.length}
          hint="Connected security contacts"
          accent="emerald"
          icon={<Users className="h-4 w-4" />}
        />
        <StatTile
          label="Safety Circles"
          value={groupsList.length}
          hint="Custom broadcast groups"
          accent="cyan"
          icon={<Shield className="h-4 w-4" />}
        />
        <StatTile
          label="Warnings Received"
          value={alertsHistoryList.length}
          hint="Total threat intelligence logs"
          accent="violet"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-hairline/60 gap-2">
        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition relative ${
            activeTab === 'network'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-ink-muted hover:text-ink hover:border-hairline'
          }`}
        >
          <Users className="h-4 w-4" />
          Safety Network
          {newRequestsCount > 0 && (
            <Badge tone="brand" className="text-[10px] px-1.5 py-0 animate-pulse ml-1">
              {newRequestsCount}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'groups'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-ink-muted hover:text-ink hover:border-hairline'
          }`}
        >
          <Shield className="h-4 w-4" />
          Safety Circles
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'history'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-ink-muted hover:text-ink hover:border-hairline'
          }`}
        >
          <Clock className="h-4 w-4" />
          Warnings Log
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className="mt-6">
        {activeTab === 'network' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column: Invitations & Add Friend */}
            <div className="space-y-8 lg:col-span-1">
              {/* Add Friend Card */}
              <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
                <CardHeader className="border-b border-hairline/60">
                  <h2 className="text-md font-semibold text-ink flex items-center gap-2">
                    <UserPlus className="h-4.5 w-4.5 text-cyan-400" />
                    Add to Network
                  </h2>
                </CardHeader>
                <CardBody>
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <p className="text-[13px] text-ink-muted leading-relaxed">
                      Enter the email address of a registered FraudShield user to invite them to your safety circle.
                    </p>
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="friend@email.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        disabled={sendingInvite}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full justify-center bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 flex items-center gap-2"
                      disabled={sendingInvite || !inviteEmail.trim()}
                    >
                      {sendingInvite ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Inviting...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send Invite
                        </>
                      )}
                    </Button>
                  </form>
                </CardBody>
              </Card>

              {/* Pending Invitations Card */}
              <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
                <CardHeader className="border-b border-hairline/60 flex items-center justify-between">
                  <h2 className="text-md font-semibold text-ink flex items-center gap-2">
                    <Mail className="h-4.5 w-4.5 text-indigo-400" />
                    Pending Invites
                  </h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                    <p className="text-center py-6 text-sm text-ink-faint">No pending invites.</p>
                  ) : (
                    <div className="space-y-6">
                      {/* Incoming Requests */}
                      {incomingRequests.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                            Incoming Requests
                          </p>
                          <ul className="space-y-2">
                            {incomingRequests.map((req) => (
                              <li
                                key={req.id}
                                className="flex items-center justify-between p-3 rounded-xl border border-hairline bg-surface/30"
                              >
                                <div className="min-w-0 flex-1 pr-3">
                                  <p className="truncate text-sm font-medium text-ink">
                                    {req.friend_name}
                                  </p>
                                  <p className="truncate text-xs text-ink-faint">
                                    {req.friend_email}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleAccept(req)}
                                    className="p-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition"
                                    title="Accept request"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleReject(req)}
                                    className="p-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                                    title="Decline request"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Outgoing Requests */}
                      {outgoingRequests.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                            Sent Invites
                          </p>
                          <ul className="space-y-2">
                            {outgoingRequests.map((req) => (
                              <li
                                key={req.id}
                                className="flex items-center justify-between p-3 rounded-xl border border-hairline/60 bg-surface/10"
                              >
                                <div className="min-w-0 flex-1 pr-3">
                                  <p className="truncate text-sm font-medium text-ink">
                                    {req.friend_name}
                                  </p>
                                  <p className="truncate text-xs text-ink-faint">
                                    {req.friend_email}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRemoveConnection(req.id, req.friend_name)}
                                  className="p-1.5 rounded-lg text-ink-faint hover:text-red-400 transition shrink-0"
                                  title="Cancel Invite"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Right Column: Friends list */}
            <div className="space-y-8 lg:col-span-2">
              <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
                <CardHeader className="border-b border-hairline/60 flex items-center justify-between">
                  <h2 className="text-md font-semibold text-ink flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-emerald-400" />
                    Security Network Contacts
                  </h2>
                </CardHeader>
                <CardBody>
                  {loadingFriends ? (
                    <div className="flex items-center justify-center py-12 text-ink-faint">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading friends...
                    </div>
                  ) : friendsList.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-hairline rounded-2xl">
                      <UserMinus className="h-8 w-8 text-ink-faint mx-auto mb-3" />
                      <p className="text-sm text-ink-muted">No safety contacts added.</p>
                      <p className="text-xs text-ink-faint mt-1">
                        Send a request to start establishing your safety network.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {friendsList.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-hairline bg-surface-2/20 hover:border-hairline-bright transition hover:shadow-lg"
                        >
                          <div className="min-w-0 pr-4">
                            <p className="font-semibold text-ink truncate">{friend.name}</p>
                            <p className="text-xs text-ink-faint truncate">{friend.email}</p>
                            <p className="text-[10px] text-ink-faint mt-1 uppercase tracking-[0.14em] font-semibold">
                              Connected
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const req = requestsList.find(
                                (r) =>
                                  (r.user_id === user?.id && r.friend_id === friend.id) ||
                                  (r.friend_id === user?.id && r.user_id === friend.id)
                              )
                              const friendshipId = req?.id
                              if (friendshipId) {
                                handleRemoveConnection(friendshipId, friend.name)
                              } else {
                                toast.error('Could not locate connection ID. Try reloading.')
                              }
                            }}
                            className="p-2 rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400 transition"
                            title="Remove Contact"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column: Create Group */}
            <div className="space-y-4 lg:col-span-1">
              <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
                <CardHeader className="border-b border-hairline/60">
                  <h2 className="text-md font-semibold text-ink flex items-center gap-2">
                    <Plus className="h-4.5 w-4.5 text-cyan-400" />
                    Create Safety Circle
                  </h2>
                </CardHeader>
                <CardBody>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <p className="text-[13px] text-ink-muted leading-relaxed">
                      Groups let you broadcast fraud warnings to multiple contacts simultaneously.
                    </p>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="e.g. Family Circle"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        required
                        disabled={creatingGroup}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      className="w-full justify-center"
                      disabled={creatingGroup || !newGroupName.trim()}
                    >
                      {creatingGroup ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Circle'
                      )}
                    </Button>
                  </form>
                </CardBody>
              </Card>
            </div>

            {/* Right Column: Groups Grid */}
            <div className="lg:col-span-2 space-y-6">
              {loadingGroups ? (
                <div className="flex items-center justify-center py-12 text-ink-faint">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading circles...
                </div>
              ) : groupsList.length === 0 ? (
                <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
                  <CardBody className="text-center py-12">
                    <Users className="h-8 w-8 text-ink-faint mx-auto mb-3" />
                    <p className="text-sm text-ink-muted">No safety groups created.</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupsList.map((group) => {
                    const isCreator = group.creator_id === user?.id
                    const memberIds = new Set(group.members.map((m) => m.id))
                    const joinableFriends = friendsList.filter((f) => !memberIds.has(f.id))

                    return (
                      <Card
                        key={group.id}
                        className="border border-hairline/60 bg-abyss/45 backdrop-blur-xl overflow-hidden hover:border-hairline-bright transition flex flex-col justify-between"
                      >
                        <div>
                          <CardHeader className="border-b border-hairline/60 bg-surface/20 flex items-center justify-between px-5 py-4">
                            <div className="min-w-0">
                              <h3 className="text-md font-semibold text-ink flex items-center gap-2 truncate">
                                {group.name}
                              </h3>
                              <p className="text-[10px] text-ink-faint mt-0.5 uppercase tracking-wider font-semibold">
                                {isCreator ? 'Owner' : 'Member'}
                              </p>
                            </div>
                            {isCreator && (
                              <button
                                onClick={() => handleDeleteGroup(group.id, group.name)}
                                className="p-1 rounded-lg text-ink-faint hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Delete Group"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </CardHeader>
                          <CardBody className="p-5 space-y-4">
                            {/* Members List */}
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                                Members ({group.members.length})
                              </p>
                              <div className="max-h-40 overflow-y-auto scrollbar-none border border-hairline rounded-xl bg-surface/10 divide-y divide-hairline/40">
                                {group.members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-surface/10 transition"
                                  >
                                    <div className="min-w-0 pr-4">
                                      <p className="text-xs font-semibold text-ink truncate flex items-center gap-1">
                                        {member.name}
                                        {member.id === group.creator_id && (
                                          <Badge tone="violet" className="text-[9px] px-1 py-0 scale-90">
                                            Owner
                                          </Badge>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-ink-faint truncate">{member.email}</p>
                                    </div>
                                    {(isCreator || member.id === user?.id) &&
                                      member.id !== group.creator_id && (
                                        <button
                                          onClick={() =>
                                            handleRemoveMember(group.id, member.id, member.name)
                                          }
                                          className="p-1 rounded text-ink-faint hover:text-red-400 hover:bg-red-500/10 transition"
                                          title={member.id === user?.id ? 'Leave Group' : 'Remove Member'}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardBody>
                        </div>

                        {/* Add Member (Footer action of group card) */}
                        {isCreator && joinableFriends.length > 0 && (
                          <div className="p-5 border-t border-hairline/40 bg-surface/5 flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                                Add Member
                              </label>
                              <Select
                                value={selectedFriendForGroup[group.id] || ''}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                  setSelectedFriendForGroup((prev) => ({
                                    ...prev,
                                    [group.id]: e.target.value,
                                  }))
                                }
                                disabled={addingMemberToGroup[group.id]}
                                className="h-9 text-xs"
                              >
                                <option value="">-- Choose Friend --</option>
                                {joinableFriends.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <Button
                              variant="secondary"
                              className="h-9 px-2.5 flex items-center justify-center shrink-0"
                              onClick={() => handleAddMember(group.id)}
                              disabled={
                                !selectedFriendForGroup[group.id] ||
                                addingMemberToGroup[group.id]
                              }
                            >
                              {addingMemberToGroup[group.id] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <Card className="border border-hairline/60 bg-abyss/40 backdrop-blur-xl">
            <CardHeader
              title="Received Warnings History"
              subtitle="All fraud threats shared with you by your Safety Circle"
              icon={<Clock className="h-4.5 w-4.5 text-indigo-400" />}
            />
            <CardBody>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12 text-ink-faint">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading history...
                </div>
              ) : alertsHistoryList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-hairline rounded-2xl">
                  <Clock className="h-8 w-8 text-ink-faint mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">No safety warnings received yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-hairline/40 text-[10px] uppercase font-semibold tracking-wider text-ink-faint">
                        <th className="pb-3 pl-4">Sender</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Target Details</th>
                        <th className="pb-3">Warning Message</th>
                        <th className="pb-3">Severity</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date Received</th>
                        <th className="pb-3 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline/40">
                      {alertsHistoryList.map((alert) => (
                        <tr
                          key={alert.id}
                          className="hover:bg-surface/10 transition text-sm text-ink-muted"
                        >
                          <td className="py-3.5 pl-4 font-medium text-ink">
                            {alert.sender_name}
                          </td>
                          <td className="py-3.5 font-mono text-xs">{alert.scan_type}</td>
                          <td className="py-3.5 max-w-[200px] truncate" title={alert.target_label}>
                            {alert.target_label}
                          </td>
                          <td className="py-3.5 max-w-[240px] truncate italic" title={alert.note}>
                            {alert.note ? `“${alert.note}”` : '—'}
                          </td>
                          <td className="py-3.5">
                            <Badge
                              tone={RISK_ACCENT[alert.risk_level] || 'danger'}
                              className="font-semibold text-[10px] uppercase"
                            >
                              {alert.risk_level}
                            </Badge>
                          </td>
                          <td className="py-3.5">
                            {alert.is_read ? (
                              <Badge tone="neutral" className="text-[9px] py-0">Read</Badge>
                            ) : (
                              <Badge tone="brand" className="text-[9px] py-0 animate-pulse">New</Badge>
                            )}
                          </td>
                          <td className="py-3.5 text-xs text-ink-faint">
                            {formatDateTime(alert.created_at)}
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <Link
                              to={`/dashboard/scans/${alert.scan_id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                            >
                              View Scan
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
