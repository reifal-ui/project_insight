import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
    login: async (email, password) => {
        const response = await api.post('/auth/login/', { email, password });
        return response.data;
    },

    register: async (userData) => {
        const response = await api.post('/auth/register/', userData);
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/profile/');
        return response.data
    },

    logout: async () => {
        const response = await api.post('/auth/logout/');
        return response.data;
    },
};

export const surveyAPI = {
    getAll: async () => {
        const response = await api.get('/surveys/');
        return response.data;
    },

    getById: async (surveyId) => {
        const response = await api.get(`/surveys/${surveyId}/`);
        return response.data;
    },

    create: async (surveyData) => {
        const response = await api.post('/surveys/', surveyData);
        return response.data
    },

    update: async (surveyId, surveyData) => {
        const response = await api.put(`/surveys/${surveyId}/`, surveyData);
        return response.data
    },

    delete: async (surveyId) => {
        const response = await api.delete(`/surveys/${surveyId}/`);
        return response.data;
    },

    publish: async (surveyId) => {
        const response = await api.post(`/surveys/${surveyId}/publish/`);
        return response.data;
    },

    close: async (surveyId) => {
        const response = await api.post(`/surveys/${surveyId}/close/`);
        return response.data
    },

    getAnalytics: async (surveyId) => {
        const response = await api.get(`/surveys/${surveyId}/analytics/`);
        return response.data;
    },

    getResponses: async (surveyId) => {
        const response = await api.get(`/surveys/${surveyId}/responses/`);
        return response.data;
    },
};

export const contactAPI = {
    getAll: async () => {
        const response = await api.get('/responddents/contacts/');
        return response.data
    },

    create: async (contactData) => {
        const response = await api.post('/respondents/contacts/', contactData);
        return response.data;
    },

    getList: async () => {
        const response = await api.get('/respondents/contact-lists/');
        return response.data;
    },

    importCSV: async (formData) => {
        const response = await api.post('/respondents/contacts/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
};

export default api;