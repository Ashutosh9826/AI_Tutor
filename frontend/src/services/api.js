import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add token if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthorized errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    return null;
  },

  googleLogin: async (credential, role) => {
    const response = await api.post('/auth/google', { credential, role });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }
};

export const classService = {
  getClasses: async () => {
    const response = await api.get('/classes');
    return response.data;
  },
  createClass: async (classData) => {
    const response = await api.post('/classes', classData);
    return response.data;
  },
  joinClass: async (classCode) => {
    const response = await api.post('/classes/join', { class_code: classCode });
    return response.data;
  }
};

export const assignmentService = {
  getByClass: async (classId) => {
    const response = await api.get(`/assignments/class/${classId}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/assignments/${id}`);
    return response.data;
  },
  create: async (assignmentData) => {
    const response = await api.post('/assignments', assignmentData);
    return response.data;
  },
  submit: async (id, fileUrl) => {
    const response = await api.post(`/assignments/${id}/submit`, { file_url: fileUrl });
    return response.data;
  },
  getSubmissions: async (id) => {
    const response = await api.get(`/assignments/${id}/submissions`);
    return response.data;
  },
  grade: async (submissionId, gradeData) => {
    const response = await api.put(`/assignments/submissions/${submissionId}/grade`, gradeData);
    return response.data;
  }
};

export const lessonService = {
  getByClass: async (classId) => {
    const response = await api.get(`/lessons/class/${classId}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/lessons/${id}`);
    return response.data;
  },
  create: async (lessonData) => {
    const response = await api.post('/lessons', lessonData);
    return response.data;
  },
  update: async (id, lessonData) => {
    const response = await api.put(`/lessons/${id}`, lessonData);
    return response.data;
  },
  generateAi: async (promptData) => {
    const response = await api.post('/lessons/generate', promptData);
    return response.data;
  }
};

export const chatService = {
  sendMessage: async (lessonId, messages) => {
    const response = await api.post('/lesson-chat/message', { lessonId, messages });
    return response.data;
  },
  evaluateAnswer: async (question, idealAnswer, studentAnswer) => {
    const response = await api.post('/lesson-chat/evaluate-answer', { question, idealAnswer, studentAnswer });
    return response.data;
  }
};

export default api;
