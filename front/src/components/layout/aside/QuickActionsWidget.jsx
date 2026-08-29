import { useNavigate } from 'react-router-dom'
import { IconEscanear } from '../../icons'

export default function QuickActionsWidget() {
  const navigate = useNavigate()

  return (
    <section className="aside-widget">
      <h3>Acciones rápidas</h3>
      <button
        className="btn-primary aside-btn"
        onClick={() => navigate('/qr/escanear')}
      >
        <IconEscanear size={16} />
        Escanear QR
      </button>
    </section>
  )
}
