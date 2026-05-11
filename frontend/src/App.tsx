import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { PageSkeleton } from './components/ui/Skeleton'
import './index.css'

const Home = lazy(() => import('./pages/Home'))
const AgentDebate = lazy(() => import('./pages/AgentDebate'))
const DialecticEngine = lazy(() => import('./pages/DialecticEngine'))
const History = lazy(() => import('./pages/History'))
const Chat = lazy(() => import('./pages/Chat'))
const QA = lazy(() => import('./pages/QA'))
const DualChat = lazy(() => import('./pages/DualChat'))
const SocraticQA = lazy(() => import('./pages/SocraticQA'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/agent-debate" element={<AgentDebate />} />
                <Route path="/dialectic-engine" element={<DialecticEngine />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/dual-chat" element={<DualChat />} />
                <Route path="/qa" element={<QA />} />
                <Route path="/socratic-qa" element={<SocraticQA />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
        <ToastContainer />
      </div>
    </Router>
  )
}

export default App
