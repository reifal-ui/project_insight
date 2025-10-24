import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

const API_BASE_URL = "http://localhost:8000/api/v1";

interface QuestionOption {
  option_id: string;
  option_text: string;
  option_value?: string;
  order: number;
}

interface Question {
  question_id: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  order: number;
  rating_min?: number;
  rating_max?: number;
  rating_min_label?: string;
  rating_max_label?: string;
  placeholder_text?: string;
  help_text?: string;
  options?: QuestionOption[];
}

interface Survey {
  survey_id: string;
  title: string;
  description: string;
  allow_anonymous: boolean;
  collect_email: boolean;
  questions: Question[];
}

export default function PublicSurveyPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentName, setRespondentName] = useState("");

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/surveys/take/${shareToken}/`);
        
        if (!response.ok) {
          throw new Error("Survey not found or closed");
        }
  
        const result = await response.json();
        
        if (result.success && result.data) {
          setSurvey(result.data);
        } else {
          throw new Error(result.message || "Failed to load survey");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load survey");
        setSurvey(null);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchSurvey();
  }, [shareToken]);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
    if (errors[questionId]) setErrors({ ...errors, [questionId]: "" });
  };

  const validateAnswers = () => {
    const newErrors: Record<string, string> = {};
    survey?.questions.forEach((q) => {
      if (q.is_required && !answers[q.question_id]) {
        newErrors[q.question_id] = "This field is required";
      }
    });
    if (survey?.collect_email && !respondentEmail) {
      newErrors.email = "Email is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAnswers()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const toastId = toast.loading("Submitting your response...");
    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, value]) => {
        const q = survey?.questions.find((x) => x.question_id === questionId);
        const a: any = { question_id: questionId };

        if (q?.question_type === "multiple_choice" || q?.question_type === "dropdown") {
          a.selected_option_ids = [value];
        } else if (q?.question_type === "checkbox") {
          a.selected_option_ids = value;
        } else if (q?.question_type === "rating") {
          a.answer_number = parseInt(value);
        } else if (q?.question_type === "date") {
          a.answer_date = value;
        } else {
          a.answer_text = value;
        }
        return a;
      });

      const res = await fetch(`${API_BASE_URL}/surveys/submit/${shareToken}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondent_email: respondentEmail,
          respondent_name: respondentName,
          answers: formattedAnswers,
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to submit response");
      }
      
      toast.success("Thank you for your response!", { id: toastId });
      setIsSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit response", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (q: Question) => {
    const value = answers[q.question_id] || "";
    const error = errors[q.question_id];

    switch (q.question_type) {
      case "short_answer":
      case "text":
      case "email":
      case "phone":
        return (
          <input
            type={q.question_type === "email" ? "email" : q.question_type === "phone" ? "tel" : "text"}
            value={value}
            onChange={(e) => handleAnswer(q.question_id, e.target.value)}
            placeholder={q.placeholder_text}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          />
        );

      case "paragraph":
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswer(q.question_id, e.target.value)}
            placeholder={q.placeholder_text}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          />
        );

      case "dropdown":
        return (
          <select
            value={value}
            onChange={(e) => handleAnswer(q.question_id, e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select an option</option>
            {q.options?.map((o) => (
              <option key={o.option_id} value={o.option_id}>
                {o.option_text}
              </option>
            ))}
          </select>
        );

      case "multiple_choice":
        return (
          <div className="space-y-2">
            {q.options?.map((o) => (
              <label key={o.option_id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name={q.question_id}
                  value={o.option_id}
                  checked={value === o.option_id}
                  onChange={(e) => handleAnswer(q.question_id, e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{o.option_text}</span>
              </label>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {q.options?.map((o) => (
              <label key={o.option_id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={value?.includes(o.option_id) || false}
                  onChange={(e) => {
                    const newVal = e.target.checked
                      ? [...(value || []), o.option_id]
                      : (value || []).filter((id: string) => id !== o.option_id);
                    handleAnswer(q.question_id, newVal);
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span>{o.option_text}</span>
              </label>
            ))}
          </div>
        );

      case "rating":
        const min = q.rating_min || 1;
        const max = q.rating_max || 5;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleAnswer(q.question_id, num.toString())}
                  className={`flex-1 py-3 px-4 border-2 rounded-lg font-medium transition ${
                    value === num.toString()
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {(q.rating_min_label || q.rating_max_label) && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>{q.rating_min_label}</span>
                <span>{q.rating_max_label}</span>
              </div>
            )}
          </div>
        );

      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswer(q.question_id, e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          />
        );

      case "time":
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleAnswer(q.question_id, e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : "border-gray-300"
            }`}
          />
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </>
    );
  }

  if (isSubmitted) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-green-600">
                <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600">Your response has been submitted successfully.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{survey?.title}</h1>
            {survey?.description && <p className="text-gray-600">{survey.description}</p>}
          </div>

          <div className="space-y-6">
            {survey?.collect_email && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your name"
                    />
                  </div>
                </div>
              </div>
            )}

            {survey?.questions.map((q, index) => (
              <div key={q.question_id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    {index + 1}. {q.question_text}
                    {q.is_required && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  {q.help_text && <p className="text-sm text-gray-500">{q.help_text}</p>}
                </div>
                {renderQuestion(q)}
                {errors[q.question_id] && (
                  <p className="text-red-500 text-sm mt-2">{errors[q.question_id]}</p>
                )}
              </div>
            ))}

            <div className="bg-white rounded-lg shadow-lg p-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-3 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? "Submitting..." : "Submit Response"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
