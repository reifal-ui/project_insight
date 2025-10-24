import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000/api/v1";
const getAuthToken = () => localStorage.getItem("token") || "";

const QUESTION_TYPES = [
  { value: "short_answer", label: "Short Answer", icon: "📝" },
  { value: "paragraph", label: "Paragraph", icon: "📄" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "⭕" },
  { value: "checkbox", label: "Checkboxes", icon: "☑️" },
  { value: "dropdown", label: "Dropdown", icon: "▼" },
  { value: "rating", label: "Rating Scale", icon: "⭐" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "time", label: "Time", icon: "🕐" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "phone", label: "Phone", icon: "📞" },
];

const MAP_QUESTION_TYPE: Record<string, string> = {
  short_answer: "text",
  paragraph: "textarea", // ✅ Fix backend error
  multiple_choice: "multiple_choice",
  checkbox: "checkbox",
  dropdown: "dropdown",
  rating: "rating",
  date: "date",
  time: "time",
  email: "email",
  phone: "text",
};

interface Question {
  question_id?: string;
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

interface QuestionOption {
  option_id?: string;
  option_text: string;
  option_value?: string;
  order: number;
}

interface Survey {
  survey_id: string;
  title: string;
  description: string;
  status: string;
  is_public: boolean;
  allow_anonymous: boolean;
  collect_email: boolean;
  questions: Question[];
}

function ComponentCard({ title, desc, children }: any) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      {(title || desc) && (
        <div className="mb-6">
          {title && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>}
          {desc && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function QuestionEditor({ question, index, onUpdate, onDelete, onDuplicate, onMove }: any) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localQuestion, setLocalQuestion] = useState(question);

  const hasOptions = ["multiple_choice", "checkbox", "dropdown"].includes(localQuestion.question_type);

  const handleUpdate = (field: string, value: any) => {
    const updated = { ...localQuestion, [field]: value };
    setLocalQuestion(updated);
    onUpdate(index, updated);
  };

  const addOption = () => {
    const newOptions = [...(localQuestion.options || []), {
      option_text: `Option ${(localQuestion.options?.length || 0) + 1}`,
      option_value: `option_${(localQuestion.options?.length || 0) + 1}`,
      order: (localQuestion.options?.length || 0) + 1
    }];
    handleUpdate("options", newOptions);
  };

  const updateOption = (optIndex: number, text: string) => {
    const newOptions = [...(localQuestion.options || [])];
    newOptions[optIndex] = { ...newOptions[optIndex], option_text: text };
    handleUpdate("options", newOptions);
  };

  const deleteOption = (optIndex: number) => {
    const newOptions = localQuestion.options?.filter((_: any, i: number) => i !== optIndex) || [];
    handleUpdate("options", newOptions);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              <path d="M7 5L12 10L7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Q{index + 1}</span>
          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            {QUESTION_TYPES.find(t => t.value === localQuestion.question_type)?.label || localQuestion.question_type}
          </span>
          {!isExpanded && (
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
              {localQuestion.question_text || "Untitled Question"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onMove(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 15V5M10 5L5 10M10 5L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => onMove(index, 'down')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 5V15M10 15L15 10M10 15L5 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => onDuplicate(index)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6V4C6 3.44772 6.44772 3 7 3H16C16.5523 3 17 3.44772 17 4V13C17 13.5523 16.5523 14 16 14H14M4 7H13C13.5523 7 14 7.44772 14 8V16C14 16.5523 13.5523 17 13 17H4C3.44772 17 3 16.5523 3 16V8C3 7.44772 3.44772 7 4 7Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button onClick={() => onDelete(index)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4V3C6 2.44772 6.44772 2 7 2H13C13.5523 2 14 2.44772 14 3V4M8 9V14M12 9V14M4 4H16M15 4V16C15 16.5523 14.5523 17 14 17H6C5.44772 17 5 16.5523 5 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-2">
          <div>
            <input
              type="text"
              value={localQuestion.question_text}
              onChange={(e) => handleUpdate("question_text", e.target.value)}
              placeholder="Enter your question"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Type</label>
              <select
                value={localQuestion.question_type}
                onChange={(e) => handleUpdate("question_type", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {QUESTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localQuestion.is_required}
                  onChange={(e) => handleUpdate("is_required", e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
              </label>
            </div>
          </div>

          {localQuestion.question_type === "rating" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Value</label>
                <input
                  type="number"
                  value={localQuestion.rating_min || 1}
                  onChange={(e) => handleUpdate("rating_min", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Value</label>
                <input
                  type="number"
                  value={localQuestion.rating_max || 5}
                  onChange={(e) => handleUpdate("rating_max", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Label</label>
                <input
                  type="text"
                  value={localQuestion.rating_min_label || ""}
                  onChange={(e) => handleUpdate("rating_min_label", e.target.value)}
                  placeholder="e.g., Poor"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Label</label>
                <input
                  type="text"
                  value={localQuestion.rating_max_label || ""}
                  onChange={(e) => handleUpdate("rating_max_label", e.target.value)}
                  placeholder="e.g., Excellent"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          )}

          {hasOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Options</label>
              <div className="space-y-2">
                {localQuestion.options?.map((option: any, optIndex: number) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <span className="text-gray-400">{optIndex + 1}.</span>
                    <input
                      type="text"
                      value={option.option_text}
                      onChange={(e) => updateOption(optIndex, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      onClick={() => deleteOption(optIndex)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  + Add Option
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Help Text (Optional)</label>
            <input
              type="text"
              value={localQuestion.help_text || ""}
              onChange={(e) => handleUpdate("help_text", e.target.value)}
              placeholder="Additional information for respondents"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurveyEditPage() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSurvey = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch survey");

      const data = await response.json();
      setSurvey(data);
      setQuestions(data.questions || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load survey");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurvey();
  }, [surveyId]);

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: "",
      question_type: "short_answer",
      is_required: false,
      order: questions.length + 1,
      options: []
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updated: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = updated;
    setQuestions(newQuestions);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const duplicateQuestion = (index: number) => {
    const duplicated = { ...questions[index], question_id: undefined, order: questions.length + 1 };
    setQuestions([...questions, duplicated]);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const saveSurvey = async () => {
    try {
      setIsSaving(true);
      const payload = {
        title: survey?.title || "",
        description: survey?.description || "",
        questions: questions.map((q, idx) => ({
          question_id: q.question_id,
          question_text: q.question_text,
          question_type: MAP_QUESTION_TYPE[q.question_type] || "text",
          is_required: q.is_required,
          order: idx + 1,
          rating_min: q.rating_min,
          rating_max: q.rating_max,
          rating_min_label: q.rating_min_label,
          rating_max_label: q.rating_max_label,
          help_text: q.help_text,
          options: q.options?.map((o, oi) => ({
            option_id: o.option_id,
            option_text: o.option_text,
            option_value: o.option_value,
            order: oi + 1
          }))
        }))
      };

      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save survey");
      toast.success("Survey saved successfully!");
      fetchSurvey();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save survey");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <ComponentCard title={survey?.title} desc={survey?.description}>
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionEditor
              key={q.question_id || idx}
              question={q}
              index={idx}
              onUpdate={updateQuestion}
              onDelete={deleteQuestion}
              onDuplicate={duplicateQuestion}
              onMove={moveQuestion}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={addQuestion}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Question
          </button>
          <button
            onClick={saveSurvey}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Save Survey
          </button>
        </div>
      </ComponentCard>
    </div>
  );
}
