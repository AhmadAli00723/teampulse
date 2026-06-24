import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { OrgProvider } from './hooks/useOrg'
import ProtectedRoute from './components/ProtectedRoute'

import Login          from './pages/auth/Login'
import Signup         from './pages/auth/Signup'
import AcceptInvite   from './pages/auth/AcceptInvite'
import CreateOrg      from './pages/onboarding/CreateOrg'
import Dashboard      from './pages/dashboard/Dashboard'
import AnswerSurvey   from './pages/surveys/AnswerSurvey'
import SurveySettings from './pages/surveys/SurveySettings'
import SubmitFeedback from './pages/feedback/SubmitFeedback'
import FeedbackInbox  from './pages/feedback/FeedbackInbox'
import Recognition    from './pages/recognition/Recognition'
import Polls          from './pages/polls/Polls'
import OneOnOnes      from './pages/one_on_ones/OneOnOnes'
import Goals          from './pages/goals/Goals'
import Reports        from './pages/reports/Reports'
import Members        from './pages/settings/Members'
import OrgSettings    from './pages/settings/OrgSettings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"          element={<Login />} />
            <Route path="/signup"         element={<Signup />} />
            <Route path="/accept-invite"  element={<AcceptInvite />} />
            <Route path="/onboarding"     element={<CreateOrg />} />

            {/* Protected — all roles */}
            <Route path="/surveys/answer" element={<ProtectedRoute><AnswerSurvey /></ProtectedRoute>} />
            <Route path="/feedback"       element={<ProtectedRoute><SubmitFeedback /></ProtectedRoute>} />
            <Route path="/feedback/inbox" element={<ProtectedRoute requiredRole="manager"><FeedbackInbox /></ProtectedRoute>} />
            <Route path="/recognition"    element={<ProtectedRoute><Recognition /></ProtectedRoute>} />
            <Route path="/polls"          element={<ProtectedRoute><Polls /></ProtectedRoute>} />
            <Route path="/1on1s"          element={<ProtectedRoute><OneOnOnes /></ProtectedRoute>} />
            <Route path="/goals"          element={<ProtectedRoute><Goals /></ProtectedRoute>} />

            {/* Protected — manager+ */}
            <Route path="/dashboard"        element={<ProtectedRoute requiredRole="manager"><Dashboard /></ProtectedRoute>} />
            <Route path="/settings/surveys" element={<ProtectedRoute requiredRole="manager"><SurveySettings /></ProtectedRoute>} />
            <Route path="/reports"          element={<ProtectedRoute requiredRole="manager"><Reports /></ProtectedRoute>} />

            {/* Protected — admin+ */}
            <Route path="/settings/members" element={<ProtectedRoute requiredRole="admin"><Members /></ProtectedRoute>} />
            <Route path="/settings"         element={<ProtectedRoute requiredRole="admin"><OrgSettings /></ProtectedRoute>} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
