import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginView } from './views/LoginView';
import { ProductSelectView } from './views/ProductSelectView';
import { ChatView } from './views/ChatView';
import { ReportView } from './views/ReportView';
import { ReportClaimsView } from './views/ReportClaimsView';
import { ReportEvidenceView } from './views/ReportEvidenceView';
import { ReportThemesView } from './views/ReportThemesView';
import { ThemeDetailView } from './views/ThemeDetailView';
import { SourceView } from './views/SourceView';
import {
  RedirectIfAuthed,
  RequireProducts,
  RequireSession,
} from './routes/guards';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginView />} />
        </Route>

        <Route element={<RequireSession />}>
          <Route path="/select" element={<ProductSelectView />} />
        </Route>

        <Route element={<RequireProducts />}>
          <Route path="/chat" element={<ChatView />} />
          <Route path="/report" element={<ReportView />} />
          <Route path="/report/claims" element={<ReportClaimsView />} />
          <Route path="/report/evidence" element={<ReportEvidenceView />} />
          <Route path="/report/themes" element={<ReportThemesView />} />
          <Route path="/report/themes/:id" element={<ThemeDetailView />} />
          <Route path="/source/:id" element={<SourceView />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
