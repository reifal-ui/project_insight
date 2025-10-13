export const setAuthData = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

export const getToken = () => {
    return localStorage.getItem('token');
};

export const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  return !!token;
};


export const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const getUserOrganization = () => {
    const user = getUser();
    return user?.organizations?.[0] || null;
};