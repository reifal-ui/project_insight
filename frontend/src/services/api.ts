// src/services/api.ts
import axios, {
  AxiosInstance,
  AxiosResponse,
} from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Handle error response global
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);


// API untuk auth
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login/", { email, password });
    return response.data;
  },
  register: async (userData: Record<string, any>) => {
    const response = await api.post("/auth/register/", userData);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get("/profile/");
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/auth/logout/");
    return response.data;
  },
};

// API untuk survey
export const surveyAPI = {
  getAll: async () => {
    const response = await api.get("/surveys/");
    return response.data;
  },
  getById: async (surveyId: string) => {
    const response = await api.get(`/surveys/${surveyId}/`);
    return response.data;
  },
  create: async (surveyData: Record<string, any>) => {
    const response = await api.post("/surveys/", surveyData);
    return response.data;
  },
  update: async (surveyId: string, surveyData: Record<string, any>) => {
    const response = await api.put(`/surveys/${surveyId}/`, surveyData);
    return response.data;
  },
  delete: async (surveyId: string) => {
    const response = await api.delete(`/surveys/${surveyId}/`);
    return response.data;
  },
  publish: async (surveyId: string) => {
    const response = await api.post(`/surveys/${surveyId}/publish/`);
    return response.data;
  },
  close: async (surveyId: string) => {
    const response = await api.post(`/surveys/${surveyId}/close/`);
    return response.data;
  },
  getAnalytics: async (surveyId: string) => {
    const response = await api.get(`/surveys/${surveyId}/analytics/`);
    return response.data;
  },
  getResponses: async (surveyId: string) => {
    const response = await api.get(`/surveys/${surveyId}/responses/`);
    return response.data;
  },
};

// API untuk kontak
export const contactAPI = {
  getAll: async () => {
    const response = await api.get("/respondents/contacts/");
    return response.data;
  },
  create: async (contactData: Record<string, any>) => {
    const response = await api.post("/respondents/contacts/", contactData);
    return response.data;
  },
  getLists: async () => {
    const response = await api.get("/respondents/contact-lists/");
    return response.data;
  },
  importCSV: async (formData: FormData) => {
    const response = await api.post(
      "/respondents/contacts/import/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};

export default api;
