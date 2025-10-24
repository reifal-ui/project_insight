export interface User {
  id: number;
  email: string;
  name?: string;
  organizations?: any[];
}

export const setAuthData = (token: string, user: User) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const getUser = (): User | null => {
  const user = localStorage.getItem('user');
  return user ? (JSON.parse(user) as User) : null;
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const clearAuthData = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getUserOrganization = (): any | null => {
  const user = getUser();
  return user?.organizations?.[0] || null;
};
