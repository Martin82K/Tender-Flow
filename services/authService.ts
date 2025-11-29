
import { User } from '../types';

const MOCK_USER: User = {
    id: 'u1',
    name: 'Martin Kalkuš',
    email: 'martin@example.com',
    role: 'admin',
    avatarUrl: 'https://ui-avatars.com/api/?name=Martin+Kalkuš&background=F97316&color=fff',
    preferences: {
        darkMode: true,
        primaryColor: '#607AFB',
        backgroundColor: '#111827' // Dark background by default for admin
    }
};

const STORAGE_KEY = 'crm_auth_user';

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        if (email === 'martin@example.com' && password === 'password') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_USER));
            return MOCK_USER;
        }

        throw new Error('Invalid credentials');
    },

    register: async (name: string, email: string): Promise<User> => {
        await new Promise(resolve => setTimeout(resolve, 500));

        const newUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            email,
            role: 'user',
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            preferences: {
                darkMode: false,
                primaryColor: '#607AFB',
                backgroundColor: '#f5f6f8'
            }
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
        return newUser;
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem(STORAGE_KEY);
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    updateUserPreferences: async (preferences: any): Promise<User> => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) throw new Error('No user logged in');

        const updatedUser = { ...currentUser, preferences: { ...currentUser.preferences, ...preferences } };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
        return updatedUser;
    }
};
