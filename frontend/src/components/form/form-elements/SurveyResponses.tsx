import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

interface Response {
  response_id: string;
  respondent_email: string | null;
  respondent_name: string | null;
  is_completed: boolean;
  submitted_at: string | null;
  completion_time_formatted: string | null;
  answers: Answer[];
}

interface Answer {
  answer_id: string;
  question_text: string;
  question_type: string;
  display_value: string;
}

interface Survey {
  survey_id: string;
  title: string;
  status: string;
}

export default function SurveyResponses() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);

  useEffect(() => {
    fetchSurveyAndResponses();
  }, [surveyId]);

  const fetchSurveyAndResponses = async () => {
    try {
      setIsLoading(true);

      // Fetch survey details
      const surveyRes = await fetch(`${API_BASE_URL}/surveys/${surveyId}/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (surveyRes.ok) {
        const surveyData = await surveyRes.json();
        setSurvey(surveyData);
      }

      // Fetch responses
      const responsesRes = await fetch(
        `${API_BASE_URL}/surveys/${surveyId}/responses/`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (responsesRes.ok) {
        const data = await responsesRes.json();
        setResponses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error("Failed to load responses");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/TailAdmin/surveys")}
              className="flex items-center gap-2 mb-3 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to Surveys
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {survey?.title || "Survey"} - Responses
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {responses.length} total responses
            </p>
          </div>
        </div>

        {/* Responses List */}
        {responses.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-gray-400"
                >
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No responses yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Responses will appear here once people submit the survey
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {responses.map((response) => (
              <div
                key={response.response_id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer"
                onClick={() => setSelectedResponse(response)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {response.respondent_name ||
                        response.respondent_email ||
                        "Anonymous"}
                    </h3>
                    {response.respondent_email && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {response.respondent_email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        response.is_completed
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {response.is_completed ? "Completed" : "In Progress"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>Submitted: {formatDate(response.submitted_at)}</span>
                  {response.completion_time_formatted && (
                    <span>Duration: {response.completion_time_formatted}</span>
                  )}
                  <span>{response.answers.length} answers</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Response Detail Modal */}
        {selectedResponse && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedResponse(null)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Response Details
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {selectedResponse.respondent_name ||
                        selectedResponse.respondent_email ||
                        "Anonymous"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedResponse(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {selectedResponse.answers.map((answer, index) => (
                  <div
                    key={answer.answer_id}
                    className="border-b border-gray-200 dark:border-gray-800 pb-4 last:border-0"
                  >
                    <p className="font-medium text-gray-900 dark:text-white mb-2">
                      {index + 1}. {answer.question_text}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 pl-4">
                      {answer.display_value || "No answer"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}