import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { PostJob } from './pages/PostJob';
import { JobDetail } from './pages/JobDetail';
import { Reputation } from './pages/Reputation';
import { AgentSignup } from './pages/AgentSignup';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="post" element={<PostJob />} />
          <Route path="reputation" element={<Reputation />} />
          <Route path="agents/signup" element={<AgentSignup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
