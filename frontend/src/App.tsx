import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import SurveyEditPage from "./components/form/form-elements/SurveyEditPage";
import PublicSurveyPage from "./components/form/form-elements/PublicSurveyPage";
import SurveyResponsesPage from "./pages/Survey/SurveyResponsesPage";
import DistributionPage from "./pages/Survey/DistributionPage";
import ApiManagementPage from "./pages/Integration/ApiManagementPage";
import WebhookManagementPage from "./pages/Integration/WebhookManagementPage";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route path="/TailAdmin" element={<AppLayout />}>
            <Route index element={<Home />} />
            {/* Profile */}
            <Route path="profile" element={<UserProfiles />} />
            
            {/* Survey Management */}
            <Route path="surveys" element={<FormElements />} />
            <Route path="surveys/:surveyId" element={<SurveyEditPage />} />
            <Route path="surveys/:surveyId/responses" element={<SurveyResponsesPage />} />
            <Route path="surveys/:surveyId/distribution" element={<DistributionPage />} />
            
            {/* Calendar for scheduling */}
            <Route path="calendar" element={<Calendar />} />
            
            {/* Team Management */}
            <Route path="teams" element={<BasicTables />} />
            
            {/* Integrations */}
            <Route path="integrations/api" element={<ApiManagementPage />} />
            <Route path="integrations/webhook" element={<WebhookManagementPage />} />
            
            {/* Other pages */}
            <Route path="blank" element={<Blank />} />
            
            {/* Ui Elements */}
            <Route path="alerts" element={<Alerts />} />
            <Route path="avatars" element={<Avatars />} />
            <Route path="badge" element={<Badges />} />
            <Route path="buttons" element={<Buttons />} />
            <Route path="images" element={<Images />} />
            <Route path="videos" element={<Videos />} />
            
            {/* Charts */}
            <Route path="line-chart" element={<LineChart />} />
            <Route path="bar-chart" element={<BarChart />} />
          </Route>
          
          {/* Auth Layout */}
          <Route path="/TailAdmin/signin" element={<SignIn />} />
          <Route path="/TailAdmin/signup" element={<SignUp />} />
          
          {/* Public Survey - No Auth Required */}
          <Route path="/TailAdmin/survey/:shareToken" element={<PublicSurveyPage />} />
          
          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}