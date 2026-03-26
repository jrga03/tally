import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GroupLayout } from './components/GroupLayout'
import { HomePage } from './pages/HomePage'
import { GroupDashboardPage } from './pages/GroupDashboardPage'
import { AddExpensePage } from './pages/AddExpensePage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:id" element={<GroupLayout />}>
          <Route index element={<GroupDashboardPage />} />
          <Route path="expenses" element={<div>Expenses</div>} />
          <Route path="add-expense" element={<AddExpensePage />} />
          <Route path="settle" element={<div>Settle Up</div>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
