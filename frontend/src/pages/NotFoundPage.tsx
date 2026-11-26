import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button, EmptyState } from '@/components/ui'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState icon={Compass} title="Sahifa topilmadi" action={<Button onClick={() => navigate('/')}>Bosh sahifaga</Button>}>
        Bunday manzil mavjud emas yoki sizda unga ruxsat yo'q.
      </EmptyState>
    </div>
  )
}
