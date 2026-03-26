import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GroupLayout } from './components/GroupLayout'
import { HomePage } from './pages/HomePage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:id" element={<GroupLayout />}>
          <Route index element={<div>Dashboard</div>} />
          <Route path="expenses" element={<div>Expenses</div>} />
          <Route path="add-expense" element={<div>Add Expense</div>} />
          <Route path="settle" element={<div>Settle Up</div>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
