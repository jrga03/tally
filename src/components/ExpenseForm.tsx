import { Text, TextInput, NumberInput, Select, SegmentedControl, Checkbox, Button, Stack, Group, Textarea, Modal, ActionIcon, Card } from '@mantine/core'
import { IconTrash, IconEdit } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { useState, useMemo } from 'react'
import { generateId } from '../lib/id'
import { splitEqual } from '../lib/splitEqual'
import type { Expense, Split, Member, SubGroupEntry } from '../types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

interface ExpenseFormProps {
  members: Member[]
  initialData?: Expense
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  submitLabel: string
}

interface SubGroupModalProps {
  opened: boolean
  onClose: () => void
  editingSubGroup: SubGroupEntry | null
  members: Member[]
  selectedMembers: Set<string>
  onSave: (entry: SubGroupEntry) => void
}

function SubGroupModal({ opened, onClose, editingSubGroup, members, selectedMembers, onSave }: SubGroupModalProps) {
  const [label, setLabel] = useState(editingSubGroup?.label ?? '')
  const [sgAmount, setSgAmount] = useState<number | string>(
    editingSubGroup ? editingSubGroup.amount / 100 : ''
  )
  const [sgMembers, setSgMembers] = useState<Set<string>>(
    new Set(editingSubGroup?.memberIds ?? [])
  )

  const toggleSgMember = (memberId: string) => {
    setSgMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const handleSave = () => {
    const amountCentavos = typeof sgAmount === 'number' ? Math.round(sgAmount * 100) : 0
    if (amountCentavos <= 0 || sgMembers.size === 0) return
    onSave({
      id: editingSubGroup?.id ?? generateId(),
      amount: amountCentavos,
      memberIds: Array.from(sgMembers),
      label: label.trim() || undefined,
    })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingSubGroup ? 'Edit shared split' : 'Add shared split'}
      size="sm"
    >
      <Stack>
        <TextInput
          label="Label (optional)"
          placeholder="e.g. Appetizer"
          value={label}
          onChange={e => setLabel(e.currentTarget.value)}
        />
        <NumberInput
          label="Amount (₱)"
          placeholder="₱0.00"
          value={sgAmount}
          onChange={setSgAmount}
          min={0}
          decimalScale={2}
        />
        <Text fw={500} size="sm">Split among</Text>
        <Stack gap="xs">
          {members.filter(m => selectedMembers.has(m.id)).map(m => (
            <Checkbox
              key={m.id}
              label={m.name}
              checked={sgMembers.has(m.id)}
              onChange={() => toggleSgMember(m.id)}
            />
          ))}
        </Stack>
        {typeof sgAmount === 'number' && sgAmount > 0 && sgMembers.size > 0 && (
          <Text size="xs" c="dimmed">
            ₱{(sgAmount / sgMembers.size).toFixed(2)} each across {sgMembers.size} member{sgMembers.size !== 1 ? 's' : ''}
          </Text>
        )}
        <Button onClick={handleSave}>
          {editingSubGroup ? 'Save' : 'Add'}
        </Button>
      </Stack>
    </Modal>
  )
}

export function ExpenseForm({ members, initialData, onSubmit, submitLabel }: ExpenseFormProps) {
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [amount, setAmount] = useState<number | string>(
    initialData ? initialData.amount / 100 : ''
  )
  const [paidBy, setPaidBy] = useState<string | null>(initialData?.paidBy ?? null)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    initialData
      ? new Set(initialData.splits.map(s => s.memberId))
      : new Set(members.map(m => m.id))
  )
  const [exactAmounts, setExactAmounts] = useState<Record<string, number | string>>(
    initialData?.exactSplitMeta
      ? Object.fromEntries(
          Object.entries(initialData.exactSplitMeta.individualAmounts).map(([id, centavos]) => [id, centavos / 100])
        )
      : initialData && initialData.splits.length > 0
        ? Object.fromEntries(initialData.splits.map(s => [s.memberId, s.amount / 100]))
        : {}
  )
  const [percentages, setPercentages] = useState<Record<string, number | string>>({})
  const [date, setDate] = useState<string | null>(
    initialData ? dayjs(initialData.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  )
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [sharedAmount, setSharedAmount] = useState<number | string>(
    initialData?.exactSplitMeta ? initialData.exactSplitMeta.sharedAmount / 100 : ''
  )
  const [subGroups, setSubGroups] = useState<SubGroupEntry[]>(
    initialData?.exactSplitMeta?.subGroups ?? []
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const [editingSubGroup, setEditingSubGroup] = useState<SubGroupEntry | null>(null)
  const remainingCentavos = useMemo(() => {
    if (splitMethod !== 'exact') return null
    const totalCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
    if (totalCentavos <= 0) return null

    const individualTotal = members
      .filter(m => selectedMembers.has(m.id))
      .reduce((sum, m) => sum + Math.round(Number(exactAmounts[m.id] || 0) * 100), 0)
    const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
    const subGroupTotal = subGroups.reduce((sum, sg) => sum + sg.amount, 0)

    return totalCentavos - individualTotal - sharedCentavos - subGroupTotal
  }, [splitMethod, amount, members, selectedMembers, exactAmounts, sharedAmount, subGroups])

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const openAddSubGroup = () => {
    setEditingSubGroup(null)
    setModalKey(k => k + 1)
    setModalOpen(true)
  }

  const openEditSubGroup = (sg: SubGroupEntry) => {
    setEditingSubGroup(sg)
    setModalKey(k => k + 1)
    setModalOpen(true)
  }

  const deleteSubGroup = (id: string) => {
    setSubGroups(prev => prev.filter(sg => sg.id !== id))
  }

  const handleSaveSubGroup = (entry: SubGroupEntry) => {
    if (editingSubGroup) {
      setSubGroups(prev => prev.map(sg => sg.id === entry.id ? entry : sg))
    } else {
      setSubGroups(prev => [...prev, entry])
    }
    setModalOpen(false)
    setEditingSubGroup(null)
  }

  const buildSplits = (): Split[] | null => {
    const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
    const selected = members.filter(m => selectedMembers.has(m.id))
    if (selected.length === 0 || amountCentavos <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.floor(amountCentavos / selected.length)
      const remainder = amountCentavos - share * selected.length
      return selected.map((m, i) => ({
        memberId: m.id,
        amount: share + (i < remainder ? 1 : 0),
      }))
    }

    if (splitMethod === 'exact') {
      const selectedIds = selected.map(m => m.id)

      // Start with individual exact amounts
      const totals: Record<string, number> = {}
      for (const m of selected) {
        totals[m.id] = Math.round(Number(exactAmounts[m.id] || 0) * 100)
      }

      // Add shared-by-all amount
      const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
      if (sharedCentavos > 0) {
        const sharedSplits = splitEqual(sharedCentavos, selectedIds)
        for (const id of selectedIds) {
          totals[id] += sharedSplits[id]
        }
      }

      // Add sub-group amounts
      for (const sg of subGroups) {
        if (sg.amount > 0 && sg.memberIds.length > 0) {
          const sgSplits = splitEqual(sg.amount, sg.memberIds)
          for (const id of sg.memberIds) {
            if (totals[id] !== undefined) {
              totals[id] += sgSplits[id]
            }
          }
        }
      }

      const splits = selected.map(m => ({ memberId: m.id, amount: totals[m.id] }))
      const total = splits.reduce((sum, s) => sum + s.amount, 0)
      if (total !== amountCentavos) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = selected.map(m => {
        const pct = Number(percentages[m.id] || 0)
        return { memberId: m.id, amount: Math.round((pct / 100) * amountCentavos) }
      })
      const totalPct = selected.reduce((sum, m) => sum + Number(percentages[m.id] || 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    return null
  }

  const handleSubmit = () => {
    const splits = buildSplits()
    if (!splits) {
      if (splitMethod === 'exact') {
        const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
        const selected = members.filter(m => selectedMembers.has(m.id))
        const individualTotal = selected.reduce((sum, m) => sum + Math.round(Number(exactAmounts[m.id] || 0) * 100), 0)
        const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
        const subGroupTotal = subGroups.reduce((sum, sg) => sum + sg.amount, 0)
        const total = individualTotal + sharedCentavos + subGroupTotal
        if (amountCentavos > 0 && total !== amountCentavos) {
          const diff = (total - amountCentavos) / 100
          notifications.show({
            color: 'red',
            title: 'Split amounts don\u2019t match',
            message: `The split total is \u20b1${(total / 100).toFixed(2)} but the expense is \u20b1${(amountCentavos / 100).toFixed(2)} (${diff > 0 ? '+' : ''}\u20b1${diff.toFixed(2)})`,
          })
        }
      }
      return
    }
    if (!paidBy || !description.trim() || !date) return

    const exactSplitMeta = splitMethod === 'exact' && (
      (typeof sharedAmount === 'number' && sharedAmount > 0) || subGroups.length > 0
    )
      ? {
          individualAmounts: Object.fromEntries(
            members
              .filter(m => selectedMembers.has(m.id))
              .map(m => [m.id, Math.round(Number(exactAmounts[m.id] || 0) * 100)])
          ),
          sharedAmount: Math.round(Number(sharedAmount || 0) * 100),
          subGroups: subGroups.filter(sg => sg.amount > 0 && sg.memberIds.length > 0),
        }
      : undefined

    onSubmit({
      description: description.trim(),
      amount: Math.round((typeof amount === 'number' ? amount : 0) * 100),
      paidBy,
      splits,
      date: new Date(date).toISOString(),
      notes: notes.trim() || undefined,
      exactSplitMeta,
    })
  }

  return (
    <Stack>
      <TextInput label="Description" value={description} onChange={e => setDescription(e.currentTarget.value)} />
      <NumberInput label="Amount (₱)" value={amount} onChange={v => setAmount(v)} min={0} decimalScale={2} />
      <Select
        label="Paid by"
        data={members.map(m => ({ value: m.id, label: m.name }))}
        value={paidBy}
        onChange={setPaidBy}
      />
      <DatePickerInput label="Date" value={date} onChange={setDate} />

      <SegmentedControl
        value={splitMethod}
        onChange={v => setSplitMethod(v as SplitMethod)}
        data={[
          { label: 'Equal', value: 'equal' },
          { label: 'Exact', value: 'exact' },
          { label: '%', value: 'percentage' },
        ]}
      />

      {remainingCentavos !== null && (
        <Text
          size="sm"
          fw={600}
          c={remainingCentavos === 0 ? 'green' : remainingCentavos < 0 ? 'red' : 'yellow'}
          ta="center"
        >
          {remainingCentavos === 0
            ? 'Fully allocated'
            : remainingCentavos > 0
              ? `₱${(remainingCentavos / 100).toFixed(2)} remaining`
              : `₱${(Math.abs(remainingCentavos) / 100).toFixed(2)} over`}
        </Text>
      )}

      <Text fw={500} size="sm">Split among</Text>
      <Stack gap="xs">
        {members.map(m => (
          <Group key={m.id} justify="space-between">
            <Checkbox
              label={m.name}
              checked={selectedMembers.has(m.id)}
              onChange={() => toggleMember(m.id)}
            />
            {splitMethod === 'exact' && selectedMembers.has(m.id) && (
              <NumberInput
                size="xs"
                w={100}
                placeholder="₱0.00"
                value={exactAmounts[m.id] ?? ''}
                onChange={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                decimalScale={2}
              />
            )}
            {splitMethod === 'percentage' && selectedMembers.has(m.id) && (
              <NumberInput
                size="xs"
                w={80}
                placeholder="%"
                value={percentages[m.id] ?? ''}
                onChange={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                suffix="%"
              />
            )}
          </Group>
        ))}
      </Stack>

      {splitMethod === 'exact' && (
        <Stack gap="xs">
          <NumberInput
            label="Shared by all"
            placeholder="₱0.00"
            value={sharedAmount}
            onChange={setSharedAmount}
            min={0}
            decimalScale={2}
          />
          {typeof sharedAmount === 'number' && sharedAmount > 0 && selectedMembers.size > 0 && (
            <Text size="xs" c="dimmed">
              ₱{(sharedAmount / selectedMembers.size).toFixed(2)} each across {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''}
            </Text>
          )}
        </Stack>
      )}

      {splitMethod === 'exact' && subGroups.length > 0 && (
        <Stack gap="xs">
          <Text fw={500} size="sm">Shared splits</Text>
          {subGroups.map(sg => {
            const memberNames = sg.memberIds
              .map(id => members.find(m => m.id === id)?.name ?? 'Unknown')
              .join(', ')
            const perPerson = sg.memberIds.length > 0 ? sg.amount / sg.memberIds.length / 100 : 0
            return (
              <Card key={sg.id} withBorder p="xs">
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {sg.label || 'Shared split'}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      ₱{(sg.amount / 100).toFixed(2)} — {memberNames} (₱{perPerson.toFixed(2)} each)
                    </Text>
                  </div>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEditSubGroup(sg)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="sm" color="red" onClick={() => deleteSubGroup(sg.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            )
          })}
        </Stack>
      )}

      {splitMethod === 'exact' && (
        <Button variant="light" size="xs" onClick={openAddSubGroup}>
          Add shared split
        </Button>
      )}

      <Textarea
        label="Notes"
        placeholder="Add notes (optional)"
        value={notes}
        onChange={e => setNotes(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={6}
      />

      <SubGroupModal
        key={modalKey}
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSubGroup(null) }}
        editingSubGroup={editingSubGroup}
        members={members}
        selectedMembers={selectedMembers}
        onSave={handleSaveSubGroup}
      />
      <Button onClick={handleSubmit}>{submitLabel}</Button>
    </Stack>
  )
}
