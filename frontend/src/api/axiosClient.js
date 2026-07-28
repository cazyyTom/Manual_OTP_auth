import axios from "axios";

const api = axios.create({
    //pass base url to every individual axios request
    baseURL: import.meta.env.VITE_API_BASE_URL,
    //by setting it true browser can send/recieve httpOnly cookie from backend server
    withCredentials: true,
})

export default api;