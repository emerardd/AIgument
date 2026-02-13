import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import Home from './pages/Home'
import AgentDebate from './pages/AgentDebate'
import DialecticEngine from './pages/DialecticEngine'
import History from './pages/History'
import Chat from './pages/Chat'
import QA from './pages/QA'
import DualChat from './pages/DualChat'
import SocraticQA from './pages/SocraticQA'
import Settings from './pages/Settings'
import './index.css'

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <ErrorBoundary>
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
          </ErrorBoundary>
        </main>
        <Footer />
        <ToastContainer />
      </div>
    </Router>
  )
}

export default App
