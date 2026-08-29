import NotificationsWidget from './aside/NotificationsWidget'
import QuickActionsWidget from './aside/QuickActionsWidget'
import LogoutButton from './aside/LogoutButton'
import { useAside } from '../../context/AsideContext'

export default function Aside() {
  const { widgets } = useAside()

  return (
    <aside className="aside">
      <div className="aside-widgets">
        {widgets.map(Widget => (
          <Widget key={Widget.name} />
        ))}
        <NotificationsWidget />
        <QuickActionsWidget />
      </div>
      <LogoutButton />
    </aside>
  )
}
