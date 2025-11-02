import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE || "http://localhost:8001";

export const apiClient = axios.create({
  baseURL,
  withCredentials: false,
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};
