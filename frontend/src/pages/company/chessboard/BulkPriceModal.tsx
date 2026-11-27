import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Percent } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button, Field, Select, TextInput } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { Chessboard } from '@/lib/types'

const MODES = [
  { value: 'percent', label: 'Foizga (%)' },
  { value: 'amount', label: "1 m² ga summa qo'shish" },
  { value: 'set', label: "1 m² narxini o'rnatish" },
]

export function BulkPriceModal({ open, onClose, board, blockId }: { open: boolean; onClose: () => void; board: Chessboard; blockId: number | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState({ block: '', floor_from: '', floor_to: '', mode: 'percent', value: '', reason: '' })
  const [rooms, setRooms] = useState<number[]>([])

  useEffect(() => {
    if (open) {
      setF({ block: blockId ? String(blockId) : '', floor_from: '', floor_to: '', mode: 'percent', value: '', reason: '' })
      setRooms([])
    }
  }, [open, blockId])

  const roomOptions = Array.from(new Set(board.layouts.map((l) => l.rooms))).sort((a, b) => a - b)

  const run = useMutation({
    mutationFn: () =>
      api<{ updated: number; skipped_locked: number }>('/units/bulk-price/', {
        method: 'POST',
        body: {
          ...(f.block ? { block: Number(f.block) } : { project: board.project.id }),
          ...(f.floor_from ? { floor_from: Number(f.floor_from) } : {}),
          ...(f.floor_to ? { floor_to: Number(f.floor_to) } : {}),
          ...(rooms.length ? { rooms } : {}),
          mode: f.mode,
          value: f.value,
          reason: f.reason.trim(),
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.updated} ta xonadon narxi o'zgardi${r.skipped_locked ? ` · ${r.skipped_locked} ta bron/sotilgan o'zgarmadi` : ''}`)
      qc.invalidateQueries({ queryKey: ['chessboard'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['unit'] })
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title="Narxlarni ommaviy o'zgartirish" description="Bron qilingan va sotilgan xonadonlar o'zgarmaydi. Har o'zgarish tarixga yoziladi." width={560}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Qamrov" className="span-2">
          <Select value={f.block} onChange={(e) => setF({ ...f, block: e.target.value })} options={[{ value: '', label: `Butun loyiha — ${board.project.name}` }, ...board.blocks.map((b) => ({ value: String(b.id), label: b.name }))]} />
        </Field>
        <Field label="Qavatdan">
          <TextInput type="number" value={f.floor_from} onChange={(e) => setF({ ...f, floor_from: e.target.value })} placeholder="hammasi" />
        </Field>
        <Field label="Qavatgacha">
          <TextInput type="number" value={f.floor_to} onChange={(e) => setF({ ...f, floor_to: e.target.value })} placeholder="hammasi" />
        </Field>
        {roomOptions.length > 1 && (
          <div className="span-2">
            <div className="field__label" style={{ marginBottom: 6 }}>Xonalar</div>
            <div className="chips">
              {roomOptions.map((r) => (
                <button key={r} type="button" className={clsx('filter-chip', rooms.includes(r) && 'is-active')} aria-pressed={rooms.includes(r)} onClick={() => setRooms(rooms.includes(r) ? rooms.filter((x) => x !== r) : [...rooms, r])}>
                  {r === 0 ? 'Studiya' : `${r} xonali`}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Usul">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={MODES} />
        </Field>
        <Field label="Qiymat *" hint={f.mode === 'percent' ? '-50 dan 100 gacha, masalan 5 yoki -3' : "so'm"}>
          <TextInput type="number" step="any" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required />
        </Field>
        <Field label="Sabab" className="span-2">
          <TextInput value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={255} placeholder="Masalan: 1-chorak narx oshishi" />
        </Field>
        <div className="span-2 modal__foot">
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" type="submit" icon={Percent} loading={run.isPending} disabled={!f.value}>
            Qo'llash
          </Button>
        </div>
      </form>
    </Modal>
  )
}
