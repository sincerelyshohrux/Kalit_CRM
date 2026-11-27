import type { LucideIcon } from 'lucide-react'

import { Button } from '.'
import { Modal } from './Modal'

interface ConfirmProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  icon?: LucideIcon
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function Confirm({ open, title, description, confirmLabel = 'Tasdiqlash', danger, icon, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} icon={icon} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <span />
    </Modal>
  )
}
