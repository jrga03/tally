import { Tabs } from '@mantine/core'
import { IconDashboard, IconReceipt, IconPlus } from '@tabler/icons-react'
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'
import { ImportHandler } from './ImportHandler'

export function GroupLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const getTab = () => {
    if (location.pathname.endsWith('/add-expense')) return 'add'
    if (location.pathname.endsWith('/expenses')) return 'expenses'
    return 'dashboard'
  }

  return (
    <>
      <ImportHandler />
      <Outlet />
      <Tabs
        value={getTab()}
        onChange={value => {
          if (value === 'dashboard') navigate(`/group/${id}`)
          else if (value === 'expenses') navigate(`/group/${id}/expenses`)
          else if (value === 'add') navigate(`/group/${id}/add-expense`)
        }}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--mantine-color-body)' }}
      >
        <Tabs.List grow>
          <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconReceipt size={16} />}>
            Expenses
          </Tabs.Tab>
          <Tabs.Tab value="add" leftSection={<IconPlus size={16} />}>
            Add
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </>
  )
}
