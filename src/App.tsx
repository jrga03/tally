import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GroupLayout } from './components/GroupLayout'
import { HomePage } from './pages/HomePage'
import { GroupDashboardPage } from './pages/GroupDashboardPage'
import { AddExpensePage } from './pages/AddExpensePage'
import { ExpenseListPage } from './pages/ExpenseListPage'
import { SettleUpPage } from './pages/SettleUpPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:id" element={<GroupLayout />}>
          <Route index element={<GroupDashboardPage />} />
          <Route path="expenses" element={<ExpenseListPage />} />
          <Route path="add-expense" element={<AddExpensePage />} />
          <Route path="settle" element={<SettleUpPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
