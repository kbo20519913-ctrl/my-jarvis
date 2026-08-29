import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.tsx'
import { AppShell } from './components/AppShell.tsx'
import { RequireAuth, RequireOnboarding } from './components/Guards.tsx'
import { AssetsPage } from './pages/AssetsPage.tsx'
import { CommunityPage } from './pages/CommunityPage.tsx'
import { DomainPage } from './pages/DomainPage.tsx'
import { ForeignPage } from './pages/ForeignPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { OnboardingPage } from './pages/OnboardingPage.tsx'
import { TimingPage } from './pages/TimingPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<RequireOnboarding />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/market/:domain" element={<DomainPage />} />
                <Route path="/timing" element={<TimingPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="/community/:postId" element={<CommunityPage />} />
                <Route path="/foreign" element={<ForeignPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
