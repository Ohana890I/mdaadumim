import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ActivateAccount from "./pages/ActivateAccount";
import DraftSchedule from "./pages/DraftSchedule";
import AdminLogin from "./pages/AdminLogin";

import Schedule from "./pages/Schedule";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Availability from "./pages/Availability";
import Settings from "./pages/Settings";
import Volunteers from "./pages/Volunteers";
import RecentSchedules from "./pages/RecentSchedules";
import AdminStatistics from "./pages/AdminStatistics";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/availability" element={<Availability />} />
       <Route
  path="/schedule"
  element={<Schedule />}
/>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/volunteers" element={<Volunteers />} />
        <Route path="/admin/recent-schedules" element={<RecentSchedules />} />
        <Route path="/admin/statistics" element={<AdminStatistics />} />
        <Route path="/home" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
       <Route
  path="/admin/draft"
  element={<DraftSchedule />}
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;