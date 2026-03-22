import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClassStreamPage from './pages/ClassStreamPage';
import AssignmentView from './pages/AssignmentView';
import AssignmentGradingPage from './pages/AssignmentGradingPage';
import LessonEditor from './pages/LessonEditor';
import LiveLessonView from './pages/LiveLessonView';
import ClassworkPage from './pages/ClassworkPage';
import PeoplePage from './pages/PeoplePage';
import GradesPage from './pages/GradesPage';
import UtilityPage from './pages/UtilityPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CalendarPage from './pages/CalendarPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/classwork" element={<ClassworkPage />} />
      <Route path="/people" element={<PeoplePage />} />
      <Route path="/grades" element={<GradesPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/archived" element={<UtilityPage title="Archived Classes" description="Archived classes page is now connected. Next step: teacher archive/unarchive actions from class cards." />} />
      <Route path="/settings" element={<UtilityPage title="Settings" description="Settings route is now wired. Next step: profile, notification, and account preferences." />} />
      <Route path="/help" element={<UtilityPage title="Help Center" description="Help entry point is connected. Next step: FAQs, troubleshooting, and contact support." />} />
      <Route path="/privacy" element={<UtilityPage title="Privacy Policy" description="Privacy route is connected for legal content and policy disclosures." />} />
      <Route path="/terms" element={<UtilityPage title="Terms of Service" description="Terms route is connected for product usage terms and legal agreements." />} />
      <Route path="/class/stream" element={<ClassStreamPage />} />
      <Route path="/assignment/:id" element={<AssignmentView />} />
      <Route path="/assignment/:id/grade" element={<AssignmentGradingPage />} />
      <Route path="/lesson/edit" element={<LessonEditor />} />
      <Route path="/lesson/live" element={<LiveLessonView />} />
    </Routes>
  );
}

export default App;
